// The Shibboleth login flow encodes its step in the "execution" URL
// parameter, e.g. e1s1 = password, e1s2 = token selection, e1s3 = OTP entry.
function getExecutionStep() {
	const execution = new URLSearchParams(window.location.search).get(
		"execution"
	);
	const match = /^e\d+s(\d+)$/.exec(execution || "");
	return match ? match[1] : null;
}

// Read a credential from local storage, falling back to the synced
// storage used by pre-1.1 versions.
function getCredential(key, callback) {
	chrome.storage.local.get(key, (data) => {
		if (data[key] !== undefined) {
			callback(data[key]);
		} else {
			chrome.storage.sync.get(key, (legacy) => callback(legacy[key]));
		}
	});
}

async function selectOptionAndProceed() {
	const selectElement = document.querySelector(
		"#fudis_selected_token_ids_input"
	);
	if (selectElement) {
		getCredential("serialNumber", (serialNumber) => {
			if (!serialNumber) {
				console.error("serialNumber secret is not set.");
				return;
			}
			selectElement.value = serialNumber;
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

const step = getExecutionStep();
if (step === "2") {
	selectOptionAndProceed();
}
if (step === "3") {
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