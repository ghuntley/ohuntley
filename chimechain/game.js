const display = document.getElementById("display");
const chEl = document.getElementById("ch");
const lnEl = document.getElementById("ln");
let secret = "";
let typed = "";
let chain = 0;
let len = 4;
let armed = false;

function gen() {
  secret = "";
  for (let i = 0; i < len; i++) secret += String((Math.random() * 10) | 0);
  typed = "";
  armed = true;
  display.textContent = secret;
  setTimeout(() => {
    if (armed) display.textContent = "••••••••".slice(0, len);
  }, 900 + len * 120);
}

document.getElementById("new").addEventListener("click", gen);

document.addEventListener("keydown", (e) => {
  if (!armed) return;
  if (e.key >= "0" && e.key <= "9") {
    typed += e.key;
    display.textContent = "•".repeat(secret.length - typed.length) + typed;
    if (typed.length === secret.length) {
      if (typed === secret) {
        chain++;
        chEl.textContent = String(chain);
        len = Math.min(10, 4 + ((chain / 2) | 0));
        lnEl.textContent = String(len);
        armed = false;
        display.textContent = "OK — next";
        setTimeout(gen, 600);
      } else {
        chain = 0;
        chEl.textContent = "0";
        len = 4;
        lnEl.textContent = "4";
        armed = false;
        display.textContent = "miss — New code";
      }
    }
  }
});

lnEl.textContent = String(len);
