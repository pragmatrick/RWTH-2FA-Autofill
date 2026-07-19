importScripts("libs/sha1.js");

// Base32 decoding function
function base32ToHex(base32) {
	const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let bits = "";
	let hex = "";

	for (let i = 0; i < base32.length; i++) {
		const val = base32Chars.indexOf(base32.charAt(i).toUpperCase());
		if (val === -1) {
			throw new Error("Invalid base32 character");
		}
		bits += val.toString(2).padStart(5, "0");
	}

	for (let i = 0; i + 4 <= bits.length; i += 4) {
		const chunk = bits.substr(i, 4);
		hex = hex + parseInt(chunk, 2).toString(16);
	}

	return hex;
}

function dec2hex(s) {
	return (s < 15.5 ? "0" : "") + Math.round(s).toString(16);
}

function hex2dec(s) {
	return parseInt(s, 16);
}

function leftpad(str, len, pad) {
	if (len + 1 >= str.length) {
		str = new Array(len + 1 - str.length).join(pad) + str;
	}
	return str;
}

function generateOtp(secret) {
	const epoch = Math.round(new Date().getTime() / 1000.0);
	const time = leftpad(dec2hex(Math.floor(epoch / 30)), 16, "0");
	const key = base32ToHex(secret); // Convert base32 secret to HEX
	const hmac = new jsSHA("SHA-1", "HEX", {
		hmacKey: { value: key, format: "HEX" },
	});
	hmac.update(time);
	const hmacResult = hmac.getHMAC("HEX");
	const offset = hex2dec(hmacResult.substring(hmacResult.length - 1));
	let otp =
		(hex2dec(hmacResult.substr(offset * 2, 8)) & hex2dec("7fffffff")) + "";
	otp = otp.substr(otp.length - 6, 6);
	return otp;
}

// Pre-1.1 versions kept credentials in chrome.storage.sync, which uploads
// them to the browser vendor's cloud. Move them to device-local storage.
function migrateSyncToLocal() {
	const keys = ["serialNumber", "otpSecret"];
	chrome.storage.sync.get(keys, (synced) => {
		if (!synced.serialNumber && !synced.otpSecret) {
			return;
		}
		chrome.storage.local.get(keys, (local) => {
			chrome.storage.local.set({ ...synced, ...local }, () => {
				chrome.storage.sync.remove(keys);
			});
		});
	});
}
chrome.runtime.onInstalled.addListener(migrateSyncToLocal);
chrome.runtime.onStartup.addListener(migrateSyncToLocal);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "getOtp") {
		// Only answer our own pages (popup) or our content script on the SSO page.
		const fromOwnPage =
			sender.url &&
			sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
		const fromSsoPage =
			sender.url && sender.url.startsWith("https://sso.rwth-aachen.de/");
		if (sender.id !== chrome.runtime.id || (!fromOwnPage && !fromSsoPage)) {
			sendResponse({ error: "Unauthorized sender." });
			return;
		}
		chrome.storage.local.get("otpSecret", (data) => {
			chrome.storage.sync.get("otpSecret", (legacy) => {
				const otpSecret = data.otpSecret ?? legacy.otpSecret;
				if (!otpSecret) {
					console.error("OTP secret is not set.");
					sendResponse({ error: "OTP secret is not set." });
					return;
				}
				try {
					sendResponse({ otp: generateOtp(otpSecret) });
				} catch (error) {
					console.error("Failed to generate OTP:", error);
					sendResponse({ error: "Invalid OTP secret." });
				}
			});
		});
		return true; // Indicate that you want to send a response asynchronously
	}
});