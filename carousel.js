// Mobile only (the nav's 768px breakpoint): each project section becomes its own swipeable card carousel.
// Native scroll-snap handles finger tracking, flick velocity, snapping and the vertical/horizontal gesture
// lock. This script adds wrap-around, the position counter and the swipe cue. Cards stay in DOM order
// and are never hidden, so tab order and screen readers see every project.
(() => {
  const mq = matchMedia('(max-width: 768px)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = {
    has: k => { try { return !!sessionStorage.getItem(k); } catch { return false; } },
    add: k => { try { sessionStorage.setItem(k, '1'); } catch {} },
  };

  document.querySelectorAll('#featured .featured-list, #software .project-grid, #hardware .project-grid').forEach(track => {
    const cards = [...track.children];
    const n = cards.length;
    // Wrap-around needs a distinct card on each side of the current one
    if (n < 3) return;
    const section = track.closest('section');
    const cueKey = 'carousel-cue-seen:' + section.id;

    const bar = document.createElement('div');
    bar.className = 'carousel-bar';
    bar.innerHTML = '<span class="carousel-count" aria-hidden="true"></span>';
    const count = bar.firstChild;
    track.before(bar);
    track.classList.add('carousel');

    // Swipe cue over the first project's image. Purely visual: screen readers move through cards anyway
    const cueFrame = cards[0].querySelector('.featured-media, .project-media');
    const cue = document.createElement('span');
    cue.className = 'swipe-cue';
    cue.setAttribute('aria-hidden', 'true');
    cue.innerHTML = '<svg viewBox="0 0 26 12"><path d="M6 1 1 6l5 5M20 1l5 5-5 5M1 6h24"/></svg>Swipe through projects';
    cueFrame.append(cue);

    let current = 0, touching = false, syncFocus = true, timer;
    let cueDone = seen.has(cueKey), cueInView = false, idle;

    const hideCue = () => { clearTimeout(idle); cue.classList.remove('is-shown'); };
    // Shows after a second of inactivity while the first project is in front and on screen
    const armCue = () => {
      if (cueDone || cue.classList.contains('is-shown')) return;
      clearTimeout(idle);
      if (cueInView && current === 0 && mq.matches) idle = setTimeout(() => cue.classList.add('is-shown'), 1000);
    };
    const finishCue = () => {
      if (cueDone) return;
      cueDone = true;
      seen.add(cueKey);
      hideCue();
    };
    // The cue sits at the image's bottom edge, so it is readable once the lower part of the image
    // is on screen; the top margin excludes the area under the sticky nav
    new IntersectionObserver(([e]) => {
      cueInView = e.isIntersecting;
      cueInView ? armCue() : hideCue();
    }, { threshold: 0.4, rootMargin: '-60px 0px 0px 0px' }).observe(cueFrame);
    // Page scrolling counts as activity: the cue waits until things are still
    addEventListener('scroll', armCue, { passive: true });

    // Rotate the visual order so the current card always sits in slot 1, with its predecessor
    // in slot 0 and its successor in slot 2: there is always somewhere to swipe in both directions
    const layout = () => {
      cards.forEach((c, i) => c.style.setProperty('--carousel-order', (i - current + 1 + n) % n));
      track.scrollTo({ left: cards[current].offsetLeft, behavior: 'instant' });
      count.textContent = `${current + 1} / ${n}`;
    };

    // Runs once motion has stopped on a snap point; mid-drag or mid-snap positions are ignored.
    // The reorder happens only at rest, so it is never visible
    const settle = () => {
      if (touching || !mq.matches) return;
      const x = track.scrollLeft;
      const i = cards.findIndex(c => Math.abs(c.offsetLeft - x) < 1);
      if (i < 0) return;
      if (i !== current) { current = i; finishCue(); }
      if (cards[current].style.getPropertyValue('--carousel-order') !== '1') layout();
      // A drag that snapped back to the first card brings the cue back after the usual pause
      armCue();
    };
    const settleSoon = () => { clearTimeout(timer); timer = setTimeout(settle, 150); };

    // Flick velocity is left to the browser's own fling + snap. Scripted scrolls on release fight that
    // animation and make the card overshoot and crawl back at the end of the swipe
    track.addEventListener('touchstart', () => { touching = true; }, { passive: true });
    const release = () => { touching = false; settleSoon(); };
    track.addEventListener('touchend', release, { passive: true });
    track.addEventListener('touchcancel', release, { passive: true });
    track.addEventListener('scroll', () => {
      // Dragging hides the cue, but it is only retired once the card actually changes, so a
      // slightly diagonal page scroll over the cards can't use it up
      if (Math.abs(track.scrollLeft - cards[current].offsetLeft) > 8) hideCue();
      settleSoon();
    }, { passive: true });
    track.addEventListener('scrollend', settle);

    const go = step => {
      const target = cards[(current + step + n) % n];
      finishCue();
      track.scrollTo({ left: target.offsetLeft, behavior: reduce.matches ? 'instant' : 'smooth' });
      // Keep keyboard focus on the card being shown, without cutting the scroll short
      if (track.contains(document.activeElement)) {
        syncFocus = false;
        target.querySelector('a')?.focus({ preventScroll: true });
        syncFocus = true;
      }
    };
    track.addEventListener('keydown', e => {
      if (!mq.matches || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    });
    // Tabbing into an offscreen card brings it to the front
    track.addEventListener('focusin', e => {
      if (!mq.matches || !syncFocus) return;
      const i = cards.findIndex(c => c.contains(e.target));
      if (i < 0 || i === current) return;
      current = i;
      finishCue();
      requestAnimationFrame(layout);
    });

    // Resize and orientation changes move every snap point; re-anchor on the current card
    new ResizeObserver(() => { if (mq.matches && !touching) layout(); }).observe(track);

    // "View paper (DOI)" on mobile lets a featured card's three buttons fit on two rows, not three.
    // Swapped in script because splitting the label in the markup shifts the desktop button by a pixel
    const paperLinks = [...track.querySelectorAll('.btn-paper')];
    paperLinks.forEach(a => { a.dataset.label = a.textContent; });

    const apply = () => {
      paperLinks.forEach(a => { a.textContent = mq.matches ? a.dataset.label.replace('academic ', '') : a.dataset.label; });
      if (mq.matches) {
        track.setAttribute('role', 'region');
        track.setAttribute('aria-roledescription', 'carousel');
        track.setAttribute('aria-label', section.querySelector('h2').textContent);
        layout();
        armCue();
      } else {
        ['role', 'aria-roledescription', 'aria-label'].forEach(a => track.removeAttribute(a));
        hideCue();
      }
    };
    mq.addEventListener('change', apply);
    apply();
  });
})();
