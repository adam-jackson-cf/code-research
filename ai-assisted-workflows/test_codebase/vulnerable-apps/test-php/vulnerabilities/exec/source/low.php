<?php

if ($_POST['Submit'] == 'Submit') {
    $target = $_POST['ip'];
    
    if ($target) {
        $cmd = shell_exec('ping ' . $target);
        echo '<pre>' . $cmd . '</pre>';
    }
}

?>

<h1>Command Injection Test - Low Security</h1>

<form action="#" method="POST">
    <p>
        Ping a device:
        <input type="text" name="ip" size="30" maxlength="100">
        <input type="submit" name="Submit" value="Submit">
    </p>
</form>