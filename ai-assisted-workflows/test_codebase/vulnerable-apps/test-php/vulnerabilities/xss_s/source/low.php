<?php

if ($_POST['btnSign'] == 'Sign Guestbook') {
    $message = $_POST['mtxMessage'];
    $name    = $_POST['txtName'];
    
    $query  = "INSERT INTO guestbook (comment, name) VALUES ('$message', '$name')";
    $result = mysql_query($query);
    
    echo '<pre>Thank you for signing the guestbook!</pre>';
}

$query  = "SELECT * FROM guestbook";
$result = mysql_query($query);

while ($row = mysql_fetch_array($result)) {
    echo '<pre>Name: ' . $row['name'] . '<br>Message: ' . $row['comment'] . '</pre>';
}

?>

<h1>Stored XSS Test - Low Security</h1>

<form action="#" method="POST">
    <p>
        Name: <input type="text" name="txtName" size="15" maxlength="100"><br>
        Message:<br>
        <textarea name="mtxMessage" cols="50" rows="3" maxlength="1000"></textarea><br>
        <input type="submit" name="btnSign" value="Sign Guestbook">
    </p>
</form>