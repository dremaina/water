<?php
function isAdmin() {
    return isset($_SESSION['role']) && ($_SESSION['role'] === 'admin' || $_SESSION['role'] === 'master_admin');
}

function isMasterAdmin() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'master_admin';
}

function checkAdminAccess() {
    if (!isAdmin()) {
        echo json_encode(array("success" => false, "message" => "Unauthorized access"));
        exit();
    }
}

function checkMasterAdminAccess() {
    if (!isMasterAdmin()) {
        echo json_encode(array("success" => false, "message" => "Unauthorized access. Master admin privileges required."));
        exit();
    }
}

// Helper function to check if user is logged in
function checkAuthentication() {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(array("success" => false, "message" => "Please log in to continue"));
        exit();
    }
}