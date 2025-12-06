<?php

if ($_POST['Upload'] == 'Upload') {
    $target_path = "uploads/";
    $target_path = $target_path . basename($_FILES['uploaded']['name']);
    
    if (move_uploaded_file($_FILES['uploaded']['tmp_name'], $target_path)) {
        echo '<pre>File uploaded successfully to: ' . $target_path . '</pre>';
    } else {
        echo '<pre>There was an error uploading the file!</pre>';
    }
}

?>

<h1>File Upload Test - Low Security</h1>

<form enctype="multipart/form-data" action="#" method="POST">
    <p>
        Choose an image to upload:<br>
        <input name="uploaded" type="file"><br>
        <input type="submit" name="Upload" value="Upload">
    </p>
</form>