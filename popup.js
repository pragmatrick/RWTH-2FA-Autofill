document.getElementById("saveBtn").addEventListener("click", () => {
	const otpSecret = document.getElementById("otpSecret").value;
	const serialNumber = document.getElementById("serialNumber").value;

	if (otpSecret && serialNumber) {
		chrome.storage.sync.set({ otpSecret: otpSecret, serialNumber: serialNumber}, () => {
			alert("You're setup!");
		});
	} else {
		alert("Please enter a Serial Number & OTP secret.");
	}
});

// Load the existing secret (if any)
document.addEventListener("DOMContentLoaded", () => {
	chrome.storage.sync.get("otpSecret", (data) => {
		if (data.otpSecret) {
			document.getElementById("otpSecret").value = data.otpSecret;
		}
	});
    chrome.storage.sync.get("serialNumber", (data) => {
		if (data.serialNumber) {
			document.getElementById("serialNumber").value = data.serialNumber;
		}
	});
});