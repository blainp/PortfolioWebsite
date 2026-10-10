// Give each figure in a media row a flex weight equal to its image's aspect
// ratio, so images in the same row render at the same height with no cropping.
document.querySelectorAll('.media-row:not(.wide)').forEach(row => {
  const imgs = row.querySelectorAll('img');
  const apply = () => {
    if (![...imgs].every(i => i.naturalWidth)) return;
    imgs.forEach(i => { i.parentElement.style.flexGrow = i.naturalWidth / i.naturalHeight; });
  };
  imgs.forEach(i => { i.loading = 'eager'; i.complete ? apply() : i.addEventListener('load', apply); });
});
