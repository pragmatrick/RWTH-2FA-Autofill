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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("Received request:", request);
	if (request.action === "getOtp") {
		chrome.storage.sync.get("otpSecret", (data) => {
			if (data.otpSecret) {
				const otp = generateOtp(data.otpSecret);
				console.log("OTP:", otp);
				sendResponse({ otp });
			} else {
				console.error("OTP secret is not set.");
				sendResponse({ error: "OTP secret is not set." });
			}
		});
		return true; // Indicate that you want to send a response asynchronously
	}
});