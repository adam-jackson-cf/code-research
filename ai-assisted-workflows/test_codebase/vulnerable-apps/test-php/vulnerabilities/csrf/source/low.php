<?php

if ($_GET['password_new'] && $_GET['password_conf']) {
    $new_password = $_GET['password_new'];
    $conf_password = $_GET['password_conf'];
    
    if ($new_password == $conf_password) {
        $query = "UPDATE users SET password = '$new_password' WHERE user_id = 1";
        $result = mysql_query($query);
        
        echo '<pre>Password Changed</pre>';
    } else {
        echo '<pre>Passwords did not match</pre>';
    }
}

?>

<h1>CSRF Test - Low Security</h1>

<form action="#" method="GET">
    <p>
        New password: <input type="password" name="password_new" size="15"><br>
        Confirm new password: <input type="password" name="password_conf" size="15"><br>
        <input type="submit" value="Change">
    </p>
</form>