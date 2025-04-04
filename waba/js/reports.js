// Check authentication and admin access
if (!sessionStorage.getItem('user_id')) {
    window.location.href = 'login.html';
} else if (!['admin', 'master_admin'].includes(sessionStorage.getItem('role'))) {
    window.location.href = 'inventory.html';
}

// Show/hide master admin features
if (sessionStorage.getItem('role') === 'master_admin') {
    document.querySelectorAll('.master-admin-only').forEach(el => el.style.display = 'block');
}

let currentReportType = 'sales';
let lineChart = null;
let pieChart = null;

// Display user info
document.getElementById('userInfo').textContent = `Welcome, ${sessionStorage.getItem('fullName')}`;

// Handle date range selection
document.getElementById('dateRange').addEventListener('change', function(e) {
    const customRange = document.getElementById('customDateRange');
    customRange.style.display = e.target.value === 'custom' ? 'flex' : 'none';
});

function loadReport(type) {
    currentReportType = type;
    document.querySelectorAll('.list-group-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    document.getElementById('reportTitle').textContent = 
        type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') + ' Report';
    generateReport();
}

function generateReport() {
    const dateRange = document.getElementById('dateRange').value;
    let startDate = null;
    let endDate = null;

    if (dateRange === 'custom') {
        startDate = document.getElementById('startDate').value;
        endDate = document.getElementById('endDate').value;
        
        if (!startDate || !endDate) {
            showToast('Please select both start and end dates', 'error');
            return;
        }
    }

    fetch('php/report.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'generateReport',
            type: currentReportType,
            dateRange: dateRange,
            startDate: startDate,
            endDate: endDate
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayReport(data.report);
            updateCharts(data.report);
            updateStats(data.report);
        } else {
            showToast(data.message || 'Failed to generate report', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to generate report', 'error');
    });
}

function updateStats(report) {
    switch(currentReportType) {
        case 'sales':
            document.getElementById('totalRevenue').textContent = `$${report.total_revenue.toFixed(2)}`;
            document.getElementById('totalSales').textContent = report.sales.length;
            document.getElementById('activeProducts').textContent = 
                [...new Set(report.sales.map(sale => sale.product_id))].length;
            break;
        case 'inventory':
            document.getElementById('totalRevenue').textContent = 
                `$${report.products.reduce((sum, product) => sum + parseFloat(product.revenue), 0).toFixed(2)}`;
            document.getElementById('totalSales').textContent = 
                report.products.reduce((sum, product) => sum + parseInt(product.total_sales), 0);
            document.getElementById('activeProducts').textContent = report.products.length;
            break;
        case 'user_activity':
            document.getElementById('totalRevenue').textContent = 
                `$${report.users.reduce((sum, user) => sum + parseFloat(user.total_purchases || 0), 0).toFixed(2)}`;
            document.getElementById('totalSales').textContent = 
                report.users.reduce((sum, user) => sum + parseInt(user.total_purchases || 0), 0);
            document.getElementById('activeProducts').textContent = 
                report.users.filter(user => user.is_active).length;
            break;
    }
}

function updateCharts(report) {
    if (lineChart) lineChart.destroy();
    if (pieChart) pieChart.destroy();

    switch(currentReportType) {
        case 'sales':
            createSalesCharts(report);
            break;
        case 'inventory':
            createInventoryCharts(report);
            break;
        case 'user_activity':
            createUserActivityCharts(report);
            break;
    }
}

function createSalesCharts(report) {
    // Line chart for sales over time
    const salesByDate = {};
    report.sales.forEach(sale => {
        const date = new Date(sale.transaction_date).toLocaleDateString();
        salesByDate[date] = (salesByDate[date] || 0) + parseFloat(sale.total_amount);
    });

    const dates = Object.keys(salesByDate).sort();
    lineChart = new Chart(document.getElementById('chartCanvas'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Sales',
                data: dates.map(date => salesByDate[date]),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue ($)'
                    }
                }
            }
        }
    });

    // Pie chart for product distribution
    const salesByProduct = {};
    report.sales.forEach(sale => {
        salesByProduct[sale.product_name] = (salesByProduct[sale.product_name] || 0) + sale.quantity;
    });

    pieChart = new Chart(document.getElementById('pieCanvas'), {
        type: 'pie',
        data: {
            labels: Object.keys(salesByProduct),
            datasets: [{
                data: Object.values(salesByProduct),
                backgroundColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Sales by Product'
                }
            }
        }
    });
}

function createInventoryCharts(report) {
    // Bar chart for current stock levels
    lineChart = new Chart(document.getElementById('chartCanvas'), {
        type: 'bar',
        data: {
            labels: report.products.map(product => product.name),
            datasets: [{
                label: 'Current Stock',
                data: report.products.map(product => product.quantity),
                backgroundColor: 'rgb(75, 192, 192)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity'
                    }
                }
            }
        }
    });

    // Pie chart for revenue distribution
    pieChart = new Chart(document.getElementById('pieCanvas'), {
        type: 'pie',
        data: {
            labels: report.products.map(product => product.name),
            datasets: [{
                data: report.products.map(product => product.revenue),
                backgroundColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Revenue Distribution'
                }
            }
        }
    });
}

function createUserActivityCharts(report) {
    // Bar chart for user purchases
    lineChart = new Chart(document.getElementById('chartCanvas'), {
        type: 'bar',
        data: {
            labels: report.users.map(user => user.full_name),
            datasets: [{
                label: 'Total Purchases',
                data: report.users.map(user => user.total_purchases),
                backgroundColor: 'rgb(75, 192, 192)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Purchases'
                    }
                }
            }
        }
    });

    // Pie chart for user roles
    const roleDistribution = report.users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
    }, {});

    pieChart = new Chart(document.getElementById('pieCanvas'), {
        type: 'pie',
        data: {
            labels: Object.keys(roleDistribution),
            datasets: [{
                data: Object.values(roleDistribution),
                backgroundColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 205, 86)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'User Role Distribution'
                }
            }
        }
    });
}

function displayReport(report) {
    const content = document.getElementById('reportContent');
    
    switch(currentReportType) {
        case 'sales':
            displaySalesReport(report, content);
            break;
        case 'inventory':
            displayInventoryReport(report, content);
            break;
        case 'user_activity':
            displayUserActivityReport(report, content);
            break;
    }
}

function displaySalesReport(report, container) {
    container.innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Total Amount</th>
                    <th>Customer</th>
                </tr>
            </thead>
            <tbody>
                ${report.sales.map(sale => `
                    <tr>
                        <td>${new Date(sale.transaction_date).toLocaleDateString()}</td>
                        <td>${sale.product_name}</td>
                        <td>${sale.quantity}</td>
                        <td>$${parseFloat(sale.total_amount).toFixed(2)}</td>
                        <td>${sale.customer_name}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3"><strong>Total Revenue</strong></td>
                    <td colspan="2"><strong>$${report.total_revenue.toFixed(2)}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;
}

function displayInventoryReport(report, container) {
    container.innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Total Sales</th>
                    <th>Revenue</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${report.products.map(product => `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.quantity}</td>
                        <td>${product.total_sales}</td>
                        <td>$${parseFloat(product.revenue).toFixed(2)}</td>
                        <td>
                            <span class="badge bg-${product.quantity < 10 ? 'danger' : 'success'}">
                                ${product.quantity < 10 ? 'Low Stock' : 'In Stock'}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function displayUserActivityReport(report, container) {
    container.innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Total Purchases</th>
                    <th>Last Activity</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${report.users.map(user => `
                    <tr>
                        <td>${user.full_name}</td>
                        <td>${user.role}</td>
                        <td>${user.total_purchases}</td>
                        <td>${new Date(user.last_activity).toLocaleDateString()}</td>
                        <td>
                            <span class="badge bg-${user.is_active ? 'success' : 'secondary'}">
                                ${user.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function exportReport() {
    fetch('php/report.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'exportReport',
            type: currentReportType,
            dateRange: document.getElementById('dateRange').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value
        })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentReportType}_report.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast('Report exported successfully!', 'success');
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to export report', 'error');
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

// Load initial report
document.addEventListener('DOMContentLoaded', () => {
    loadReport('sales');
});

document.addEventListener('DOMContentLoaded', function() {
    // Initialize date range picker
    $('#dateRange').daterangepicker({
        opens: 'left',
        startDate: moment().subtract(30, 'days'),
        endDate: moment(),
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, function(start, end) {
        loadReportData(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
    });

    // Initialize charts
    const salesChartCtx = document.getElementById('salesChart').getContext('2d');
    const productChartCtx = document.getElementById('productChart').getContext('2d');

    const salesChart = new Chart(salesChartCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Sales',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });

    const productChart = new Chart(productChartCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });

    // Load initial data
    const startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    loadReportData(startDate, endDate);

    // Export button click handler
    document.getElementById('exportBtn').addEventListener('click', function() {
        const dates = $('#dateRange').data('daterangepicker');
        exportReport(dates.startDate.format('YYYY-MM-DD'), dates.endDate.format('YYYY-MM-DD'));
    });

    // Function to load report data
    function loadReportData(startDate, endDate) {
        fetch('php/report.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'generateReport',
                type: 'all',
                dateRange: 'custom',
                startDate: startDate,
                endDate: endDate
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateDashboard(data.report);
            } else {
                console.error('Error loading report data:', data.message);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // Function to update dashboard with new data
    function updateDashboard(report) {
        // Update summary cards
        document.getElementById('totalSales').textContent = '₱' + formatNumber(report.sales.total_revenue);
        document.getElementById('totalOrders').textContent = report.sales.sales.length;
        document.getElementById('activeProducts').textContent = report.inventory.products.length;
        document.getElementById('activeCustomers').textContent = report.users.length;

        // Update sales chart
        const salesData = processDataForSalesChart(report.sales.sales);
        salesChart.data.labels = salesData.labels;
        salesChart.data.datasets[0].data = salesData.values;
        salesChart.update();

        // Update product distribution chart
        const productData = processDataForProductChart(report.inventory.products);
        productChart.data.labels = productData.labels;
        productChart.data.datasets[0].data = productData.values;
        productChart.update();

        // Update tables
        updateSalesTable(report.sales.sales);
        updateInventoryTable(report.inventory.products);
        updateCustomersTable(report.users);
    }

    // Function to process sales data for chart
    function processDataForSalesChart(sales) {
        const salesByDate = {};
        sales.forEach(sale => {
            const date = moment(sale.transaction_date).format('YYYY-MM-DD');
            salesByDate[date] = (salesByDate[date] || 0) + parseFloat(sale.total_amount);
        });

        const sortedDates = Object.keys(salesByDate).sort();
        return {
            labels: sortedDates.map(date => moment(date).format('MMM D')),
            values: sortedDates.map(date => salesByDate[date])
        };
    }

    // Function to process product data for chart
    function processDataForProductChart(products) {
        const sortedProducts = [...products].sort((a, b) => b.total_sales - a.total_sales).slice(0, 5);
        return {
            labels: sortedProducts.map(p => p.name),
            values: sortedProducts.map(p => p.total_sales)
        };
    }

    // Function to update sales table
    function updateSalesTable(sales) {
        const tbody = document.getElementById('salesTable');
        tbody.innerHTML = '';
        
        sales.forEach(sale => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${moment(sale.transaction_date).format('MMM D, YYYY HH:mm')}</td>
                <td>${sale.product_name}</td>
                <td>${sale.customer_name}</td>
                <td>${sale.quantity}</td>
                <td>₱${formatNumber(sale.total_amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Function to update inventory table
    function updateInventoryTable(products) {
        const tbody = document.getElementById('inventoryTable');
        tbody.innerHTML = '';
        
        products.forEach(product => {
            const tr = document.createElement('tr');
            const status = getStockStatus(product.quantity);
            tr.innerHTML = `
                <td>${product.name}</td>
                <td>${product.quantity}</td>
                <td>${product.total_sales || 0}</td>
                <td>₱${formatNumber(product.revenue || 0)}</td>
                <td><span class="badge bg-${status.color}">${status.text}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Function to update customers table
    function updateCustomersTable(users) {
        const tbody = document.getElementById('customersTable');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            const status = getCustomerStatus(user.last_activity);
            tr.innerHTML = `
                <td>${user.full_name}</td>
                <td>${user.total_purchases}</td>
                <td>₱${formatNumber(user.total_spent)}</td>
                <td>${moment(user.last_purchase).fromNow()}</td>
                <td><span class="badge bg-${status.color}">${status.text}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Function to export report
    function exportReport(startDate, endDate) {
        window.location.href = `php/report.php?action=exportReport&type=all&dateRange=custom&startDate=${startDate}&endDate=${endDate}`;
    }

    // Utility functions
    function formatNumber(number) {
        return parseFloat(number).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function getStockStatus(quantity) {
        if (quantity <= 0) {
            return { text: 'Out of Stock', color: 'danger' };
        } else if (quantity <= 10) {
            return { text: 'Low Stock', color: 'warning' };
        } else {
            return { text: 'In Stock', color: 'success' };
        }
    }

    function getCustomerStatus(lastActivity) {
        const daysSinceLastActivity = moment().diff(moment(lastActivity), 'days');
        if (daysSinceLastActivity <= 30) {
            return { text: 'Active', color: 'success' };
        } else if (daysSinceLastActivity <= 90) {
            return { text: 'Inactive', color: 'warning' };
        } else {
            return { text: 'Dormant', color: 'danger' };
        }
    }

    // Check session and update UI
    fetch('php/user.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'checkSession'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            window.location.href = 'login.html';
        } else {
            document.getElementById('userFullName').textContent = data.user.full_name;
        }
    })
    .catch(error => console.error('Error:', error));

    // Logout handler
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        fetch('php/user.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'logout'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = 'login.html';
            }
        })
        .catch(error => console.error('Error:', error));
    });
});