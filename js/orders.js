// Check authentication
if (!sessionStorage.getItem('user_id')) {
    window.location.href = 'login.html';
}

// Initialize orders page
document.addEventListener('DOMContentLoaded', function() {
    updateCartBadge();
    loadUserOrders();
    setupDateFilter();
});

function setupDateFilter() {
    const dateFilter = document.getElementById('dateFilter');
    const customDateRange = document.getElementById('customDateRange');
    
    dateFilter.addEventListener('change', function() {
        customDateRange.style.display = this.value === 'custom' ? 'block' : 'none';
        if (this.value !== 'custom') {
            filterOrders();
        }
    });
}

function filterOrders() {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    let dateFrom = '';
    let dateTo = '';

    switch(dateFilter) {
        case 'today':
            dateFrom = new Date().toISOString().split('T')[0];
            dateTo = dateFrom;
            break;
        case 'week':
            const week = new Date();
            week.setDate(week.getDate() - 7);
            dateFrom = week.toISOString().split('T')[0];
            dateTo = new Date().toISOString().split('T')[0];
            break;
        case 'month':
            const month = new Date();
            month.setMonth(month.getMonth() - 1);
            dateFrom = month.toISOString().split('T')[0];
            dateTo = new Date().toISOString().split('T')[0];
            break;
        case 'custom':
            return; // Custom date range is handled by applyCustomDateFilter()
    }

    loadUserOrders(statusFilter, dateFrom, dateTo);
}

function applyCustomDateFilter() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const statusFilter = document.getElementById('statusFilter').value;

    if (!dateFrom || !dateTo) {
        showToast('Please select both start and end dates', 'error');
        return;
    }

    loadUserOrders(statusFilter, dateFrom, dateTo);
}

function loadUserOrders(status = '', dateFrom = '', dateTo = '') {
    const params = {
        action: 'getUserOrders'
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

function updateOrderStats(orders) {
    const totalOrders = orders.length;
    const activeOrders = orders.filter(order => 
        ['pending', 'processing', 'in_transit', 'out_for_delivery'].includes(order.current_status)
    ).length;
    const completedOrders = orders.filter(order => 
        order.current_status === 'delivered'
    ).length;

    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('activeOrders').textContent = activeOrders;
    document.getElementById('completedOrders').textContent = completedOrders;
}

function updateOrdersUI(orders) {
    const ordersContainer = document.getElementById('ordersList');
    
    if (!orders.length) {
        ordersContainer.innerHTML = `
            <div class="text-center p-5">
                <i class="bi bi-inbox text-muted" style="font-size: 3rem;"></i>
                <h4 class="mt-3">No Orders Found</h4>
                <p class="text-muted">You haven't placed any orders yet.</p>
                <a href="inventory.html" class="btn btn-primary">
                    <i class="bi bi-cart-plus me-2"></i>Start Shopping
                </a>
            </div>`;
        return;
    }
    
    ordersContainer.innerHTML = orders.map(order => `
        <div class="order-card card mb-4">
            <div class="card-header bg-white d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-0">Order #${order.id}</h5>
                    <small class="text-muted">Placed on ${new Date(order.created_at).toLocaleDateString()}</small>
                </div>
                <span class="badge bg-${getStatusColor(order.current_status)} px-3 py-2">
                    ${formatStatus(order.current_status)}
                </span>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <div class="mb-4">
                            <h6 class="mb-3">Items:</h6>
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
                        <div class="d-flex justify-content-between border-top pt-3">
                            <h6>Total Amount:</h6>
                            <h5 class="text-primary">₱${order.total_amount}</h5>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <h6 class="mb-3">Order Tracking:</h6>
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
                <div class="mt-3 border-top pt-3">
                    <button class="btn btn-outline-primary" onclick="generateReceipt(${order.id})">
                        <i class="bi bi-file-earmark-text me-2"></i>Download Receipt
                    </button>
                    <a href="inventory.html" class="btn btn-outline-secondary">
                        <i class="bi bi-arrow-repeat me-2"></i>Buy Again
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

function formatStatus(status) {
    return status.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
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