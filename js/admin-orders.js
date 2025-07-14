// Check authentication and admin role
if (!sessionStorage.getItem('user_id') || sessionStorage.getItem('role') !== 'admin') {
    window.location.href = 'login.html';
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadOrders();
    setDateDefaults();
});

function setDateDefaults() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    document.getElementById('dateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('dateTo').value = today.toISOString().split('T')[0];
}

function loadOrders(status = '', dateFrom = '', dateTo = '') {
    const params = {
        action: 'getAllOrders'
    };

    if (status) params.status = status;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateOrdersUI(data.orders);
            updateOrderStats(data.orders);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to load orders', 'error');
    });
}

function updateOrdersUI(orders) {
    const ordersContainer = document.getElementById('ordersList');
    
    if (!orders.length) {
        ordersContainer.innerHTML = `
            <div class="text-center p-5">
                <i class="bi bi-inbox text-muted" style="font-size: 3rem;"></i>
                <h4 class="mt-3">No Orders Found</h4>
                <p class="text-muted">There are no orders matching your filters.</p>
            </div>`;
        return;
    }
    
    ordersContainer.innerHTML = orders.map(order => `
        <div class="order-card card mb-4">
            <div class="card-header bg-white d-flex justify-content-between align-items-center">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${order.id}" id="order-${order.id}">
                    <label class="form-check-label" for="order-${order.id}">
                        <h5 class="mb-0">Order #${order.id}</h5>
                        <small class="text-muted d-block">
                            Placed by: ${order.customer_name} (${order.customer_phone})
                        </small>
                    </label>
                </div>
                <div class="d-flex gap-2 align-items-center">
                    <span class="badge bg-${getStatusColor(order.current_status)} px-3 py-2">
                        ${formatStatus(order.current_status)}
                    </span>
                    <button class="btn btn-sm btn-outline-primary" onclick="showStatusModal(${order.id})">
                        Update Status
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <div class="mb-4">
                            <h6 class="mb-3">Order Items:</h6>
                            ${order.items.map(item => `
                                <div class="d-flex align-items-center mb-2">
                                    <img src="${item.image}" class="rounded" width="50" height="50" style="object-fit: cover;">
                                    <div class="ms-3">
                                        <h6 class="mb-0">${item.name}</h6>
                                        <small class="text-muted">₱${item.price_per_unit} × ${item.quantity}</small>
                                    </div>
                                    <div class="ms-auto">
                                        <span class="text-primary">₱${item.subtotal}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="border-top pt-3">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Delivery Address:</h6>
                                    <p class="text-muted mb-0">${order.delivery_address}</p>
                                </div>
                                <div class="col-md-6 text-md-end">
                                    <h6>Total Amount:</h6>
                                    <h5 class="text-primary mb-0">₱${order.total_amount}</h5>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <h6 class="mb-3">Order Timeline:</h6>
                        <div class="tracking-timeline">
                            ${order.tracking.map(track => `
                                <div class="tracking-item">
                                    <div class="tracking-icon bg-${getStatusColor(track.status)}"></div>
                                    <div class="tracking-content">
                                        <p class="mb-0"><strong>${formatStatus(track.status)}</strong></p>
                                        <small class="text-muted">${new Date(track.created_at).toLocaleString()}</small>
                                        ${track.notes ? `<p class="mb-0 small text-muted">${track.notes}</p>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-footer bg-white">
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-secondary btn-sm" onclick="printReceipt(${order.id})">
                        <i class="bi bi-printer me-2"></i>Print Receipt
                    </button>
                    <button class="btn btn-outline-primary btn-sm" onclick="contactCustomer('${order.customer_phone}')">
                        <i class="bi bi-telephone me-2"></i>Contact Customer
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateOrderStats(orders) {
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('pendingOrders').textContent = 
        orders.filter(order => order.current_status === 'pending').length;
    document.getElementById('processingOrders').textContent = 
        orders.filter(order => order.current_status === 'processing').length;
    document.getElementById('deliveredOrders').textContent = 
        orders.filter(order => order.current_status === 'delivered').length;
}

function showStatusModal(orderId) {
    document.getElementById('updateOrderId').value = orderId;
    const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
    modal.show();
}

function updateOrderStatus() {
    const orderId = document.getElementById('updateOrderId').value;
    const status = document.getElementById('orderStatus').value;
    const notes = document.getElementById('statusNotes').value;

    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'updateOrderStatus',
            orderId: orderId,
            status: status,
            notes: notes
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('updateStatusModal')).hide();
            loadOrders();
            showToast('Order status updated successfully', 'success');
        } else {
            showToast(data.message || 'Failed to update order status', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to update order status', 'error');
    });
}

function bulkUpdateStatus(status) {
    const selectedOrders = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);

    if (!selectedOrders.length) {
        showToast('Please select orders to update', 'error');
        return;
    }

    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'bulkUpdateStatus',
            orderIds: selectedOrders,
            status: status
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadOrders();
            showToast('Orders updated successfully', 'success');
        } else {
            showToast(data.message || 'Failed to update orders', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to update orders', 'error');
    });
}

function filterOrders(status) {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    loadOrders(status, dateFrom, dateTo);
}

function applyDateFilter() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    if (!dateFrom || !dateTo) {
        showToast('Please select both start and end dates', 'error');
        return;
    }

    loadOrders('', dateFrom, dateTo);
}

function refreshOrders() {
    loadOrders();
    showToast('Orders refreshed', 'success');
}

function contactCustomer(phone) {
    // Implementation depends on your communication method
    // For now, just show the phone number
    showToast(`Contact customer at: ${phone}`, 'info');
}

function formatStatus(status) {
    return status.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getStatusColor(status) {
    switch(status) {
        case 'pending':
            return 'warning';
        case 'processing':
            return 'info';
        case 'in_transit':
            return 'primary';
        case 'out_for_delivery':
            return 'info';
        case 'delivered':
            return 'success';
        case 'cancelled':
            return 'danger';
        default:
            return 'secondary';
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