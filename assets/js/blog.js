const blogBody = document.body;
const blogPreloader = document.getElementById('preloader');
const closeBlogPreloader = () => { if (blogPreloader) blogPreloader.classList.add('hide'); };
if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(closeBlogPreloader, 500);
else window.addEventListener('load', () => setTimeout(closeBlogPreloader, 500), { once: true });
setTimeout(closeBlogPreloader, 1600);

const blogCursor = document.querySelector('.cursor');
const blogCursorDot = document.querySelector('.cursor-dot');
let blogCursorX = 0, blogCursorY = 0, blogTargetX = 0, blogTargetY = 0;
addEventListener('pointermove', event => {
  blogTargetX = event.clientX; blogTargetY = event.clientY;
  if (blogCursorDot) { blogCursorDot.style.left = `${blogTargetX}px`; blogCursorDot.style.top = `${blogTargetY}px`; }
});
function moveBlogCursor() {
  blogCursorX += (blogTargetX - blogCursorX) * .16; blogCursorY += (blogTargetY - blogCursorY) * .16;
  if (blogCursor) { blogCursor.style.left = `${blogCursorX}px`; blogCursor.style.top = `${blogCursorY}px`; }
  requestAnimationFrame(moveBlogCursor);
}
moveBlogCursor();
document.querySelectorAll('.hoverable').forEach(element => {
  element.addEventListener('mouseenter', () => blogBody.classList.add('is-hover'));
  element.addEventListener('mouseleave', () => blogBody.classList.remove('is-hover'));
});

const blogProgress = document.getElementById('progress');
const blogRailFill = document.getElementById('railFill');
function updateBlogProgress() {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const percent = Math.max(0, Math.min(1, scrollY / max)) * 100;
  if (blogProgress) blogProgress.style.width = `${percent}%`;
  if (blogRailFill) blogRailFill.style.height = `${percent}%`;
}
addEventListener('scroll', updateBlogProgress, { passive: true });
updateBlogProgress();

const blogObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) entry.target.classList.add('on');
}), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(element => blogObserver.observe(element));
