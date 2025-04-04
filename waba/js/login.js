document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    fetch('php/user.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'login',
            email: email,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Store user data in session storage
            sessionStorage.setItem('user_id', data.user_id);
            sessionStorage.setItem('role', data.role);
            
            // Redirect based on role
            if (['admin', 'master_admin'].includes(data.role)) {
                window.location.href = 'reports.html';
            } else {
                window.location.href = 'inventory.html';
            }
        } else {
            alert(data.message || 'Login failed. Please check your credentials.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Login failed. Please try again.');
    });
});