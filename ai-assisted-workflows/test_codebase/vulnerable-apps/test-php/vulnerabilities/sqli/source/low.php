<?php

if ($_GET['Submit'] == 'Submit') {
    $id = $_GET['id'];
    
    $query = "SELECT first_name, last_name FROM users WHERE user_id = " . $id;
    $result = mysql_query($query);
    
    $num = mysql_numrows($result);
    
    if ($num > 0) {
        $i = 0;
        while ($i < $num) {
            $first = mysql_result($result, $i, "first_name");
            $last  = mysql_result($result, $i, "last_name");
            
            echo '<pre>ID: ' . $id . '<br>First name: ' . $first . '<br>Surname: ' . $last . '</pre>';
            $i++;
        }
    } else {
        echo '<pre>User ID is MISSING from the database.</pre>';
    }
}

?>

<h1>SQL Injection Test - Low Security</h1>

<form action="#" method="GET">
    <p>
        User ID:
        <input type="text" size="15" name="id">
        <input type="submit" name="Submit" value="Submit">
    </p>
</form>