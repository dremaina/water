// Check authentication
if (!sessionStorage.getItem('user_id')) {
    window.location.href = 'login.html';
}

// Initialize cart functionality
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop();
    updateCartBadge();
    
    if (currentPage === 'cart.html') {
        loadCart();
        loadUserOrders();
    }
});

function loadCart() {
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'getCart'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateCartUI(data);
            updateCartBadge(data.items.length);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to load cart', 'error');
    });
}

function updateCartUI(data) {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const cartTotal2 = document.getElementById('cartTotal2');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (!data.items.length) {
        cartItems.innerHTML = `
            <div class="text-center p-5">
                <i class="bi bi-cart-x text-muted" style="font-size: 3rem;"></i>
                <h4 class="mt-3">Your cart is empty</h4>
                <p class="text-muted">Add some products to your cart and they will appear here.</p>
                <a href="inventory.html" class="btn btn-primary">
                    <i class="bi bi-cart-plus me-2"></i>Continue Shopping
                </a>
            </div>`;
        cartTotal.innerHTML = '₱0.00';
        cartTotal2.innerHTML = '₱0.00';
        checkoutBtn.disabled = true;
        return;
    }
    
    cartItems.innerHTML = data.items.map(item => `
        <div class="cart-item mb-3">
            <div class="row align-items-center">
                <div class="col-auto">
                    <img src="${item.image}" class="rounded" width="80" height="80" alt="${item.name}">
                </div>
                <div class="col">
                    <h5 class="mb-1">${item.name}</h5>
                    <p class="text-muted mb-0">Unit Price: ₱${item.price}</p>
                </div>
                <div class="col-auto">
                    <div class="quantity-control">
                        <button class="btn btn-sm btn-outline-primary" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">
                            <i class="bi bi-dash"></i>
                        </button>
                        <span class="mx-2">${item.quantity}</span>
                        <button class="btn btn-sm btn-outline-primary" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">
                            <i class="bi bi-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="col-auto text-end">
                    <h5 class="text-primary mb-1">₱${item.subtotal.toFixed(2)}</h5>
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="removeFromCart(${item.id})">
                        <i class="bi bi-trash me-1"></i>Remove
                    </button>
                </div>
            </div>
        </div>
    `).join('<hr class="my-3">');
    
    cartTotal.innerHTML = `₱${data.total.toFixed(2)}`;
    cartTotal2.innerHTML = `₱${data.total.toFixed(2)}`;
    checkoutBtn.disabled = false;
}

function updateQuantity(cartId, newQuantity) {
    if (newQuantity < 1) return;
    
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'updateCart',
            cartId: cartId,
            quantity: newQuantity
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadCart();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to update quantity', 'error');
    });
}

function removeFromCart(cartId) {
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'removeFromCart',
            cartId: cartId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadCart();
            showToast('Item removed from cart', 'success');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to remove item', 'error');
    });
}

function checkout() {
    const deliveryAddress = document.getElementById('deliveryAddress').value;
    if (!deliveryAddress) {
        showToast('Please enter delivery address', 'error');
        return;
    }
    
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'checkout',
            deliveryAddress: deliveryAddress
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMpesaPaymentModal(data.order_id, data.total_amount);
        } else {
            showToast(data.message || 'Checkout failed', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Checkout failed', 'error');
    });
}

function showMpesaPaymentModal(orderId, amount) {
    const modal = new bootstrap.Modal(document.getElementById('mpesaModal'));
    document.getElementById('mpesaAmount').textContent = `₱${amount.toFixed(2)}`;
    document.getElementById('mpesaOrderId').value = orderId;
    modal.show();
}

function initiatePayment() {
    const orderId = document.getElementById('mpesaOrderId').value;
    const phoneNumber = document.getElementById('mpesaPhone').value;
    
    if (!phoneNumber.match(/^\d{10}$/)) {
        showToast('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'initiatePayment',
            orderId: orderId,
            phoneNumber: phoneNumber
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('mpesaModal')).hide();
            showToast('Payment successful! Check your orders for tracking.', 'success');
            loadUserOrders();
        } else {
            showToast(data.message || 'Payment failed', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Payment failed', 'error');
    });
}

function loadUserOrders() {
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'getUserOrders'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateOrdersUI(data.orders);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to load orders', 'error');
    });
}

function updateOrdersUI(orders) {
    const ordersContainer = document.getElementById('userOrders');
    
    if (!orders.length) {
        ordersContainer.innerHTML = '<div class="text-center p-4">No orders found</div>';
        return;
    }
    
    ordersContainer.innerHTML = orders.map(order => `
        <div class="order-card card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Order #${order.id}</h5>
                <span class="badge bg-${getStatusColor(order.current_status)}">${order.current_status}</span>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <h6>Items:</h6>
                        ${order.items.map(item => `
                            <div class="d-flex justify-content-between mb-2">
                                <span>${item.name} x ${item.quantity}</span>
                                <span>₱${item.subtotal}</span>
                            </div>
                        `).join('')}
                        <hr>
                        <div class="d-flex justify-content-between">
                            <strong>Total:</strong>
                            <strong>₱${order.total_amount}</strong>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <h6>Tracking:</h6>
                        <div class="tracking-timeline">
                            ${order.tracking.map(track => `
                                <div class="tracking-item">
                                    <div class="tracking-icon bg-${getStatusColor(track.status)}"></div>
                                    <div class="tracking-content">
                                        <p class="mb-0"><strong>${track.status}</strong></p>
                                        <small>${new Date(track.created_at).toLocaleString()}</small>
                                        ${track.notes ? `<p class="mb-0 text-muted">${track.notes}</p>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="mt-3">
                    <button class="btn btn-primary" onclick="generateReceipt(${order.id})">
                        <i class="bi bi-download me-2"></i>Download Receipt
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function generateReceipt(orderId) {
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'generateReceipt',
            orderId: orderId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            generatePDF(data.receipt);
        } else {
            showToast(data.message || 'Failed to generate receipt', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to generate receipt', 'error');
    });
}

function generatePDF(receipt) {
    const doc = new jsPDF();
    const logo = 'data:image/png;base64,...'; // Add your logo here
    
    // Header
    doc.addImage(logo, 'PNG', 10, 10, 50, 20);
    doc.setFontSize(20);
    doc.text('Water Vending Receipt', 70, 20);
    
    // Order Details
    doc.setFontSize(12);
    doc.text(`Order #: ${receipt.id}`, 10, 40);
    doc.text(`Date: ${new Date(receipt.created_at).toLocaleString()}`, 10, 50);
    doc.text(`Customer: ${receipt.full_name}`, 10, 60);
    doc.text(`Phone: ${receipt.phone}`, 10, 70);
    doc.text(`Address: ${receipt.delivery_address}`, 10, 80);
    
    // Items Table
    let y = 100;
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y, 190, 10, 'F');
    doc.text('Item', 15, y + 7);
    doc.text('Qty', 100, y + 7);
    doc.text('Price', 130, y + 7);
    doc.text('Total', 160, y + 7);
    
    y += 15;
    receipt.items.forEach(item => {
        doc.text(item.name, 15, y);
        doc.text(item.quantity.toString(), 100, y);
        doc.text(`₱${item.price_per_unit}`, 130, y);
        doc.text(`₱${item.subtotal}`, 160, y);
        y += 10;
    });
    
    // Total
    y += 10;
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y, 190, 10, 'F');
    doc.text('Total Amount:', 130, y + 7);
    doc.text(`₱${receipt.total_amount}`, 160, y + 7);
    
    // Payment Details
    y += 20;
    doc.text('Payment Details', 10, y);
    y += 10;
    doc.text(`Method: M-Pesa`, 10, y);
    doc.text(`Transaction ID: ${receipt.mpesa_transaction}`, 10, y + 10);
    
    // Footer
    doc.setFontSize(10);
    const pageHeight = doc.internal.pageSize.height;
    doc.text('Thank you for your business!', 10, pageHeight - 20);
    
    // Save PDF
    doc.save(`receipt-${receipt.id}.pdf`);
}

function getStatusColor(status) {
    switch(status) {
        case 'order_placed':
            return 'info';
        case 'payment_received':
            return 'primary';
        case 'processing':
            return 'warning';
        case 'in_transit':
            return 'info';
        case 'out_for_delivery':
            return 'primary';
        case 'delivered':
            return 'success';
        case 'cancelled':
            return 'danger';
        default:
            return 'secondary';
    }
}

function updateCartBadge(count) {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.createElement('div');
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '1050';
    
    toastContainer.innerHTML = `
        <div class="toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'primary'} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toastContainer);
    const toast = new bootstrap.Toast(toastContainer.querySelector('.toast'));
    toast.show();
    
    toast._element.addEventListener('hidden.bs.toast', () => {
        toastContainer.remove();
    });
}