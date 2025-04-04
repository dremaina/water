// Check authentication
if (!sessionStorage.getItem('user_id')) {
    window.location.href = 'login.html';
}

// Show/hide admin features
if (sessionStorage.getItem('role') === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
}

// Display user info
document.getElementById('userInfo').textContent = `Welcome, ${sessionStorage.getItem('fullName')}`;

// Load products and cart badge on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartBadge();
});

function loadProducts() {
    fetch('php/inventory.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'getProducts'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const productsList = document.getElementById('productsList');
            productsList.innerHTML = '';
            
            data.products.forEach(product => {
                const productCard = createProductCard(product);
                productsList.appendChild(productCard);
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to load products', 'error');
    });
}

function createProductCard(product) {
    const col = document.createElement('div');
    col.className = 'col-md-4 col-lg-3';
    
    const defaultImage = 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=400';
    
    col.innerHTML = `
        <div class="product-card card h-100">
            <div class="position-relative">
                <img src="${product.image || defaultImage}" class="card-img-top" alt="${product.name}">
                <span class="stock-badge badge ${product.quantity < 10 ? 'bg-danger' : 'bg-success'}">
                    ${product.quantity < 10 ? 'Low Stock' : 'In Stock'}
                </span>
            </div>
            <div class="card-body d-flex flex-column">
                <h5 class="card-title">${product.name}</h5>
                <p class="card-text text-muted">${product.description}</p>
                <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="price">₱${parseFloat(product.price).toFixed(2)}</span>
                        <span class="text-muted">Available: ${product.quantity}</span>
                    </div>
                    <div class="d-flex gap-2">
                        <input type="number" class="form-control form-control-sm w-25" 
                               min="1" max="${product.quantity}" value="1" id="qty-${product.id}">
                        <button class="btn btn-primary flex-grow-1" onclick="addToCart(${product.id})">
                            <i class="bi bi-cart-plus me-2"></i>Add to Cart
                        </button>
                    </div>
                    ${sessionStorage.getItem('role') === 'admin' ? `
                        <div class="mt-2 d-flex gap-2">
                            <button class="btn btn-warning btn-sm w-50" onclick="editProduct(${product.id})">
                                <i class="bi bi-pencil me-2"></i>Edit
                            </button>
                            <button class="btn btn-danger btn-sm w-50" onclick="deleteProduct(${product.id})">
                                <i class="bi bi-trash me-2"></i>Delete
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    return col;
}

function addProduct() {
    const productData = {
        action: 'addProduct',
        name: document.getElementById('productName').value,
        price: document.getElementById('productPrice').value,
        quantity: document.getElementById('productQuantity').value,
        description: document.getElementById('productDescription').value,
        image: document.getElementById('productImage').value
    };

    fetch('php/inventory.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
            document.getElementById('addProductForm').reset();
            loadProducts();
            showToast('Product added successfully!', 'success');
        } else {
            showToast(data.message || 'Failed to add product', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to add product', 'error');
    });
}

function purchaseProduct(productId, button) {
    const quantityInput = button.parentElement.querySelector('input');
    const quantity = parseInt(quantityInput.value);

    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

    fetch('php/inventory.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'purchase',
            productId: productId,
            quantity: quantity
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadProducts();
            showToast('Purchase successful!', 'success');
        } else {
            showToast(data.message || 'Purchase failed', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Purchase failed', 'error');
    })
    .finally(() => {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-cart-plus me-2"></i>Purchase';
    });
}

function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    fetch('php/inventory.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'deleteProduct',
            productId: productId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadProducts();
            showToast('Product deleted successfully!', 'success');
        } else {
            showToast(data.message || 'Failed to delete product', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to delete product', 'error');
    });
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

function logout() {
    fetch('php/user.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'logout'
        })
    })
    .then(() => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Logout failed', 'error');
    });
}

function addToCart(productId) {
    const quantity = parseInt(document.getElementById(`qty-${productId}`).value);
    if (quantity < 1) {
        showToast('Please select a valid quantity', 'error');
        return;
    }
    
    fetch('php/cart.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'addToCart',
            productId: productId,
            quantity: quantity
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Added to cart successfully!', 'success');
            // Call the updateCartBadge function from cart.js
            fetch('php/cart.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'getCart' })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateCartBadge(data.items.length);
                }
            });
        } else {
            showToast(data.message || 'Failed to add to cart', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to add to cart', 'error');
    });
}

function updateCartBadge() {
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
            const badge = document.getElementById('cartBadge');
            if (badge) {
                badge.textContent = data.items.length;
                badge.style.display = data.items.length > 0 ? 'inline-block' : 'none';
            }
        }
    })
    .catch(error => console.error('Error:', error));
}