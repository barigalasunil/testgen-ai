{


    "testCases": [
        {
            "title": "Happy path checkout flow with valid user information and correct order summary",
            "steps": "1. Click the \"Checkout\" button on the Cart page.\n2. On the User Info page, enter First Name \"John\".\n3. Enter Last Name \"Doe\".\n4. Enter Zip Code \"12345\".\n5. Click the \"Continue\" button.\n6. On the Overview page, verify that Item A and Item B are listed.\n7. Verify Item Total displays $50.00.\n8. Verify Tax displays $5.00 (10% of $50.00).\n9. Verify Total displays $55.00.\n10. Click the \"Finish\" button.\n11. Verify the Order Confirmation page shows the message \"THANK YOU FOR YOUR ORDER\".",
            "expectedResult": "User proceeds from Cart to Order Confirmation without errors; product list matches cart items; calculations are correct; confirmation message is displayed."
        },
        {
            "title": "Prevent navigation when First Name is left blank",
            "steps": "1. Click the \"Checkout\" button on the Cart page.\n2. On the User Info page, leave First Name empty.\n3. Enter Last Name \"Doe\".\n4. Enter Zip Code \"12345\".\n5. Click the \"Continue\" button.",
            "expectedResult": "The Continue button remains disabled or an error message \"First Name is required\" appears; First Name field is highlighted; user does not navigate to the Overview page."
        },
        {
            "title": "Display error for invalid Zip Code format",
            "steps": "1. Click the \"Checkout\" button on the Cart page.\n2. On the User Info page, enter First Name \"John\".\n3. Enter Last Name \"Doe\".\n4. Enter Zip Code \"12AB\".\n5. Click the \"Continue\" button.",
            "expectedResult": "An error message \"Zip Code must be numeric\" is displayed; Zip Code field is highlighted; navigation to Overview is blocked."
        },
        {
            "title": "Validate Zip Code length boundary (4 digits should be rejected)",
            "steps": "1. Click the \"Checkout\" button on the Cart page.\n2. On the User Info page, enter First Name \"Jane\".\n3. Enter Last Name \"Smith\".\n4. Enter Zip Code \"1234\".\n5. Click the \"Continue\" button.",
            "expectedResult": "An error message \"Zip Code must be 5 digits\" is displayed; Zip Code field is highlighted; user cannot proceed to Overview."
        },
        {
            "title": "Prevent direct URL access to Overview without completing User Info",
            "steps": "1. In the browser address bar, navigate directly to the Overview page URL (e.g., https://ecommerce.example.com/checkout-step-two).",
            "expectedResult": "System redirects the user to the User Info step or shows an access denied message; no JavaScript errors occur."
        },
        {
            "title": "Preserve entered user information when using browser Back button from Overview",
            "steps": "1. Click the browser Back button.\n2. Verify the User Info page displays First Name \"John\", Last Name \"Doe\", and Zip Code \"12345\".\n3. Click the \"Continue\" button again.\n4. Verify the Overview page loads without errors and shows the correct order summary.",
            "expectedResult": "All previously entered fields retain their values; navigation back and forward works without script failures; order summary remains accurate."
        },
        {
            "title": "Cancel checkout at Overview and verify context is preserved on forward navigation",
            "steps": "1. Click the \"Cancel\" button on the Overview page (returns to Cart).\n2. Click the browser Forward button.\n3. Verify the Overview page reappears with the same product list and order summary.\n4. Verify no error messages or script breaks are shown.",
            "expectedResult": "The Overview page restores correctly with preserved data; no errors are displayed."
        }
    ]
}