const clock = document.getElementById('clock');
const date = document.getElementById('date');
const greeting = document.getElementById('greeting');
function updateTime() {
  const now = new Date();
  clock.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now);
  date.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now).toUpperCase();
  const hour = now.getHours();
  greeting.textContent = hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
}
updateTime();
setInterval(updateTime, 30000);
document.getElementById('search-form').addEventListener('submit', event => {
  event.preventDefault();
  const query = document.getElementById('query').value.trim();
  if (!query) return;
  const hasUrlShape = /^(https?:\/\/|localhost(?::\d+)?(?:\/|$)|127\.0\.0\.1(?::\d+)?(?:\/|$)|[^\s]+\.[a-z]{2,}(?::\d+)?(?:\/|$))/i.test(query);
  if (hasUrlShape) window.location.href = /^https?:\/\//i.test(query) ? query : `https://${query}`;
  else window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
});
