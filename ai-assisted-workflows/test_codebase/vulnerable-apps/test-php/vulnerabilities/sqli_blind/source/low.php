<?php

if ($_POST['Submit'] == 'Submit') {
    $username = $_POST['username'];
    $password = $_POST['password'];
    
    $query = "SELECT * FROM users WHERE username = '" . $username . "' AND password = '" . $password . "'";
    $result = mysql_query($query);
    
    if (mysql_num_rows($result) == 1) {
        echo '<pre>Welcome ' . $username . '</pre>';
        echo '<pre>Login successful</pre>';
    } else {
        echo '<pre>Login failed</pre>';
    }
}

?>

<h1>Blind SQL Injection Test - Low Security</h1>

<form action="#" method="POST">
    <p>
        Username:
        <input type="text" name="username">
        <br><br>
        Password:
        <input type="password" name="password">
        <br><br>
        <input type="submit" name="Submit" value="Submit">
    </p>
</form>