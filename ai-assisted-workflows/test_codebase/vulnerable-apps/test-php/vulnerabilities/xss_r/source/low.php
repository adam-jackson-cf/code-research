<?php

if ($_GET['name']) {
    echo '<pre>Hello ' . $_GET['name'] . '</pre>';
}

?>

<h1>Reflected XSS Test - Low Security</h1>

<form action="#" method="GET">
    <p>
        What's your name?
        <input type="text" name="name" size="15" maxlength="100">
        <input type="submit" name="Submit" value="Submit">
    </p>
</form>