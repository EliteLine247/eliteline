document.addEventListener('DOMContentLoaded', function() {
    console.log("Page loaded");

    // Initialize Autocomplete with UK restriction
    const options = {
        componentRestrictions: { country: 'GB' } // Only show UK suggestions
    };

    const pickupInput = document.getElementById('pickup');
    const dropoffInput = document.getElementById('dropoff');

    // Apply UK restriction to both input fields
    const pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
    const dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput, options);

    console.log("Autocomplete initialized with UK restriction");

    // Form submission handler
    document.getElementById('distanceForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent traditional form submission
        console.log("Form submitted");

        // Get the values from the input fields
        const pickupLocation = pickupInput.value;
        const dropoffLocation = dropoffInput.value;
        const returnJourney = document.getElementById('return').checked;

        console.log("Pickup location:", pickupLocation);
        console.log("Dropoff location:", dropoffLocation);

        if (!pickupLocation || !dropoffLocation) {
            alert('Please fill in both pickup and dropoff locations');
            return;
        }

        console.log("Starting Distance Matrix API call...");

        // Call the Google Maps API to calculate distance
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
            origins: [pickupLocation],
            destinations: [dropoffLocation],
            travelMode: 'DRIVING',
        }, function(response, status) {
            console.log("API call status:", status);
            if (status === 'OK') {
                console.log("API Response:", response);
                const distance = response.rows[0].elements[0].distance.value / 1000; // Distance in km
                const pricePerKm = 1.5; // Example price per km
                let totalPrice = distance * pricePerKm;

                if (returnJourney) {
                    totalPrice *= 2;
                }

                // Display the results
                document.getElementById('distance').innerText = `Distance: ${distance.toFixed(2)} km`;
                document.getElementById('price').innerText = `Price: £${totalPrice.toFixed(2)}`;
            } else {
                console.error("Error with Distance Matrix API call:", status);
                alert('Error calculating distance. Please try again.');
            }
        });
    });
});






