<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $fullName = $_POST['fullName'];
    $phone = $_POST['phone'];
    $email = $_POST['email'];
    $pickup = $_POST['pickup'];
    $dropoff = $_POST['dropoff'];
    $message = $_POST['message'];

    $to = "elitelin247@gmail.com";
    $subject = "New Customer Enquiry from Eliteline Website";

    $body = "
    New enquiry received:

    Full Name: $fullName
    Phone: $phone
    Email: $email
    Pickup: $pickup
    Drop-off: $dropoff

    Enquiry Message:
    $message
    ";

    $headers = "From: noreply@eliteline.com\r\nReply-To: $email";

    mail($to, $subject, $body, $headers);

    header("Location: thank-you.html");
    exit();
}
?>
