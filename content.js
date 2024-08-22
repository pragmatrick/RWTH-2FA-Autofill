function matchesUrlPattern(pattern) {
	const regex = new RegExp(pattern);
	return regex.test(window.location.href);
}

async function selectOptionAndProceed() {
	const selectElement = document.querySelector(
		"#fudis_selected_token_ids_input"
	);
	if (selectElement) {
		chrome.storage.sync.get("serialNumber", (data) => {
			if (!data.serialNumber) {
				console.error("serialNumber secret is not set.");
				return;
			}
			selectElement.value = data.serialNumber;
			selectElement.dispatchEvent(new Event("change", { bubbles: true }));

			const submitButton = document.querySelector(
				'button[name="_eventId_proceed"]'
			);
			if (submitButton) {
				submitButton.click();
			}
		});
	}
}

function fillOtpAndProceed(otpCode) {
	const otpInput = document.querySelector("#fudis_otp_input");
	if (otpInput) {
		otpInput.value = otpCode;
		otpInput.dispatchEvent(new Event("input", { bubbles: true }));
		const submitButton = document.querySelector(
			'button[name="_eventId_proceed"]'
		);
		if (submitButton) {
			submitButton.click();
		}
	}
}

console.log("manifested:" + window.location.href);
// Check the URL using regular expressions
if (matchesUrlPattern("execution=e.*s2")) {
	// Matches "execution=e" followed by any characters and then "s2"
	selectOptionAndProceed();
}
if (matchesUrlPattern("execution=e.*s3")) {
	// Matches "execution=e" followed by any characters and then "s3"
	try {
		chrome.runtime.sendMessage({ action: "getOtp" }, (response) => {
			if (response && response.otp) {
				fillOtpAndProceed(response.otp);
			}
		});
	} catch (error) {
		console.error("Error sending message:", error);
	}
}