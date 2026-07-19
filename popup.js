const CREDENTIAL_KEYS = ["serialNumber", "otpSecret"];
const DRAFT_KEYS = ["draftSerialNumber", "draftOtpSecret"];

// Drafts live in session storage: memory-only, survives the popup closing
// (e.g. switching tabs to copy the secret), wiped when the browser exits.
const draftArea = chrome.storage.session ?? chrome.storage.local;

const serialInput = document.getElementById("serialNumber");
const secretInput = document.getElementById("otpSecret");

function saveDraft() {
	draftArea.set({
		draftSerialNumber: serialInput.value,
		draftOtpSecret: secretInput.value,
	});
}
serialInput.addEventListener("input", saveDraft);
secretInput.addEventListener("input", saveDraft);

document.getElementById("saveBtn").addEventListener("click", () => {
	const serialNumber = serialInput.value.trim();
	const otpSecret = secretInput.value.trim();

	if (otpSecret && serialNumber) {
		chrome.storage.local.set({ serialNumber, otpSecret }, () => {
			draftArea.remove(DRAFT_KEYS);
			// Clean up credentials stored by pre-1.1 versions in synced storage.
			chrome.storage.sync.remove(CREDENTIAL_KEYS);
			alert("You're setup!");
		});
	} else {
		alert("Please enter a Serial Number & OTP secret.");
	}
});

// Restore fields: unsaved draft wins, then saved values (sync as pre-1.1 fallback).
document.addEventListener("DOMContentLoaded", () => {
	chrome.storage.local.get(CREDENTIAL_KEYS, (saved) => {
		chrome.storage.sync.get(CREDENTIAL_KEYS, (legacy) => {
			draftArea.get(DRAFT_KEYS, (draft) => {
				serialInput.value =
					draft.draftSerialNumber ??
					saved.serialNumber ??
					legacy.serialNumber ??
					"";
				secretInput.value =
					draft.draftOtpSecret ?? saved.otpSecret ?? legacy.otpSecret ?? "";
			});
		});
	});
});
