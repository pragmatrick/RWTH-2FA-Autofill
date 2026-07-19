const CREDENTIAL_KEYS = ["serialNumber", "otpSecret"];
const DRAFT_KEYS = ["draftSerialNumber", "draftOtpSecret"];
const PERIOD_SECONDS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * 16;

// Drafts live in session storage: memory-only, survives the popup closing
// (e.g. switching tabs to copy the secret), wiped when the browser exits.
const draftArea = chrome.storage.session ?? chrome.storage.local;

const setupView = document.getElementById("setupView");
const codeView = document.getElementById("codeView");
const serialInput = document.getElementById("serialNumber");
const secretInput = document.getElementById("otpSecret");
const cancelBtn = document.getElementById("cancelBtn");
const tokenName = document.getElementById("tokenName");
const otpCode = document.getElementById("otpCode");
const copiedToast = document.getElementById("copiedToast");
const ringProgress = document.getElementById("ringProgress");

let savedSerial = null;
let ticker = null;
let lastPeriod = null;
// The code as digits only; otpCode's text carries a space for readability.
let currentOtp = null;
let toastTimer = null;

ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;

function showSetupView() {
	stopTicker();
	cancelBtn.hidden = !savedSerial;
	codeView.hidden = true;
	setupView.hidden = false;
	serialInput.focus();
}

function showCodeView() {
	tokenName.textContent = savedSerial;
	setupView.hidden = true;
	codeView.hidden = false;
	startTicker();
}

function refreshCode() {
	chrome.runtime.sendMessage({ action: "getOtp" }, (response) => {
		if (response && response.otp) {
			currentOtp = response.otp;
			otpCode.textContent =
				response.otp.slice(0, 3) + " " + response.otp.slice(3);
		} else {
			currentOtp = null;
			otpCode.textContent = "error";
		}
	});
}

function showCopiedToast(x, y) {
	copiedToast.style.left = `${x + 10}px`;
	copiedToast.style.top = `${y + 10}px`;
	copiedToast.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => copiedToast.classList.remove("show"), 900);
}

// Synchronous fallback for when the async clipboard API is unavailable
// or rejects (it needs clipboard-write, which not every context grants).
function copyViaTextarea(text) {
	const scratch = document.createElement("textarea");
	scratch.value = text;
	scratch.setAttribute("readonly", "");
	scratch.style.position = "fixed";
	scratch.style.opacity = "0";
	document.body.appendChild(scratch);
	scratch.select();
	let ok = false;
	try {
		ok = document.execCommand("copy");
	} catch (error) {
		ok = false;
	}
	scratch.remove();
	return ok;
}

function copyCode(x, y) {
	if (!currentOtp) {
		return;
	}
	const fallback = () => {
		if (copyViaTextarea(currentOtp)) {
			showCopiedToast(x, y);
		} else {
			console.error("Copy failed.");
		}
	};
	if (navigator.clipboard) {
		navigator.clipboard
			.writeText(currentOtp)
			.then(() => showCopiedToast(x, y), fallback);
	} else {
		fallback();
	}
}

otpCode.addEventListener("click", (event) => {
	copyCode(event.clientX, event.clientY);
});

otpCode.addEventListener("keydown", (event) => {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		// No cursor position for a keyboard activation: anchor to the code.
		const box = otpCode.getBoundingClientRect();
		copyCode(box.right - 10, box.bottom - 14);
	}
});

function tick() {
	const seconds = Date.now() / 1000;
	const period = Math.floor(seconds / PERIOD_SECONDS);
	if (period !== lastPeriod) {
		lastPeriod = period;
		refreshCode();
	}
	// The ring fills up as the 30s period elapses; full ring = fresh code next.
	const progress = (seconds % PERIOD_SECONDS) / PERIOD_SECONDS;
	ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
}

function startTicker() {
	if (!ticker) {
		tick();
		ticker = setInterval(tick, 200);
	}
}

function stopTicker() {
	clearInterval(ticker);
	ticker = null;
	lastPeriod = null;
}

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

	if (!serialNumber || !otpSecret) {
		alert("Please enter a Serial Number & OTP secret.");
		return;
	}
	chrome.storage.local.set({ serialNumber, otpSecret }, () => {
		draftArea.remove(DRAFT_KEYS);
		// Clean up credentials stored by pre-1.1 versions in synced storage.
		chrome.storage.sync.remove(CREDENTIAL_KEYS);
		savedSerial = serialNumber;
		serialInput.value = "";
		secretInput.value = "";
		showCodeView();
	});
});

document.getElementById("redoBtn").addEventListener("click", () => {
	serialInput.value = "";
	secretInput.value = "";
	showSetupView();
});

cancelBtn.addEventListener("click", () => {
	draftArea.remove(DRAFT_KEYS);
	serialInput.value = "";
	secretInput.value = "";
	showCodeView();
});

// Decide which view to open with: an in-progress setup (draft) wins,
// otherwise show the live code if a token pair is saved.
chrome.storage.local.get(CREDENTIAL_KEYS, (saved) => {
	chrome.storage.sync.get(CREDENTIAL_KEYS, (legacy) => {
		draftArea.get(DRAFT_KEYS, (draft) => {
			savedSerial = saved.serialNumber ?? legacy.serialNumber ?? null;
			const hasSecret = Boolean(saved.otpSecret ?? legacy.otpSecret);
			const hasDraft = Boolean(draft.draftSerialNumber || draft.draftOtpSecret);
			if (savedSerial && hasSecret && !hasDraft) {
				showCodeView();
			} else {
				serialInput.value = draft.draftSerialNumber ?? "";
				secretInput.value = draft.draftOtpSecret ?? "";
				showSetupView();
			}
		});
	});
});
