let gameState = {
  indicatorEls: document.querySelectorAll('.indicator'),
  editingEl: null,
  mousedown: false,
  currentPlayer: 0,
  playerPositions: [{x: 0, y: 0}, {x: 0, y: 0}, {x: 0, y: 0}, {x: 0, y: 0}]
};

const articlesEl = document.querySelector('#articles');
const xSlider = document.querySelector('#x-slider');
const ySlider = document.querySelector('#y-slider');
const gameEl = document.querySelector('#game');
const refreshButton = document.querySelector('#refresh');

var template = document.createElement('template');
template.innerHTML = `<div class="article">
  <div class="article-imageContainer">
    <img class="article-image">
    <div class="article-buttons">
      <button class="button article-edit" aria-label="Search for a new thing">✏️</button>
      <button class="button article-random" aria-label="Replace with a random thing">♻️</button>
    </div>
  </div>
  <input type="text" class="article-search">
  <a target="blank" href="" class="article-link">
    <h2 class="article-title"></h2>
  </a>
</div>`;

async function wikipediaAPI(queryParams) {
  // todo: somehow only fetch articles with thumbnails?
  const response = await fetch(`https://en.wikipedia.org/w/api.php?pithumbsize=200&${queryParams}`, {
    mode: "cors", // no-cors, *cors, same-origin
    headers: {
      "Origin": window.location,
      "Content-Type": "application/json; charset=UTF-8"
    },
  });

  try {
    return await response.json();
  }
  catch (err) {
    console.error('Error parsing output', err);
    return null;
  }
}

async function getRandomArticles() {
  let articles = [];
  let responseData = await wikipediaAPI("format=json&action=query&generator=random&grnnamespace=0&grnlimit=24&prop=pageimages&redirects=1&origin=*");
  if (responseData) {
    articles = Object.values(responseData.query.pages).filter(article => article.thumbnail).slice(0,4);
  }
  
  // Make sure we get 4 that have thumbnails
  if (articles.length < 4) {
    const moreArticles = await getRandomArticles();
    articles = articles.concat(moreArticles);
  }

  return articles;
}

async function articleSearch(query) {
  let articles = [];
  let responseData = await wikipediaAPI(`format=json&action=query&generator=search&prop=pageimages&redirects=1&origin=*&gsrsearch=${encodeURIComponent(query)}`);
  if (responseData) {
    articles = Object.values(responseData.query.pages).filter(article => article.thumbnail);
  }

  return articles;
}

const printArticles = async () => {
  const articles = await getRandomArticles();
  articlesEl.innerHTML = '';
  for (let article of articles) {
    const articleEl = template.content.cloneNode(true);
    setArticleContent(articleEl, article);
    articlesEl.appendChild(articleEl);
  }
};

async function replaceWithRandom(articleEl) {
  // todo: fetch less from Wikipedia API when replacing one article
  const articles = await getRandomArticles();
  setArticleContent(articleEl, articles[0]);
}

function setArticleContent(articleEl, article) {
  articleEl.querySelector('.article-link').href = `https://en.wikipedia.org/?curid=${article.pageid}`;
  articleEl.querySelector('.article-title').innerText = article.title;
  articleEl.querySelector('.article-image').src = article.thumbnail?.source;
  articleEl.querySelector('.article-image').alt = article.title;

  // todo: change aria-label of sliders to correspond to the names of the articles so we're accessible
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const handleMouseEvent = (event) => {
  const rect = gameEl.getBoundingClientRect();
  const xPos = event.clientX - rect.left;
  const yPos = event.clientY - rect.top;
  const xValue = clamp(xPos / gameEl.offsetWidth * 100, 0, 100);
  const yValue = clamp(100 - yPos / gameEl.offsetHeight * 100, 0, 100);
  setPlayerPosition(gameState.currentPlayer, xValue, yValue);
};

function setCurrentPlayer(playerNumber) {
  gameState.currentPlayer = playerNumber;
  xSlider.value = gameState.playerPositions[gameState.currentPlayer].x;
  ySlider.value = gameState.playerPositions[gameState.currentPlayer].y;
}

function setPlayerPosition(player, xValue, yValue) {
  const rect = gameEl.getBoundingClientRect();
  xSlider.value = xValue;
  ySlider.value = yValue;
  gameState.indicatorEls[player].style.left = (xValue / 100 * rect.width) + 'px';
  gameState.indicatorEls[player].style.top = ((100 - yValue) / 100 * rect.height) + 'px';
  gameState.playerPositions[player].x = xValue;
  gameState.playerPositions[player].y = yValue;
}

function setPlayerPositionFromSliders() {
  setPlayerPosition(gameState.currentPlayer, parseFloat(xSlider.value), parseFloat(ySlider.value));
}

async function doSearch(articleEl) {
  const query = articleEl.querySelector('.article-search').value;
  const results = await articleSearch(query);
  setArticleContent(articleEl, results[0]);
  toggleEditMode(articleEl);
}

function toggleEditMode(articleEl) {
  if (articleEl.classList.contains('is-editing')) {
    articleEl.classList.remove('is-editing');
    gameState.editingEl = null;
  }
  else {
    if (gameState.editingEl) {
      toggleEditMode(gameState.editingEl);
    }
    gameState.editingEl = articleEl;
    articleEl.classList.add('is-editing');
    const existingText = articleEl.querySelector('.article-title').innerText;
    const searchField = articleEl.querySelector('.article-search');
    searchField.value = existingText;
    searchField.focus();
    searchField.select();
  }
}

xSlider.addEventListener('change', setPlayerPositionFromSliders);
ySlider.addEventListener('change', setPlayerPositionFromSliders);

window.addEventListener('pointerdown', (event) => {
  const indicator = event.target.closest('.indicator');
  if (event.target === gameEl) {
    gameState.mouseDown = true;
  }
  else if (indicator) {
    gameState.currentPlayer = parseFloat(indicator.getAttribute('data-player'));
    gameState.mouseDown = true;
  }
});
window.addEventListener('pointerup', () => gameState.mouseDown = false);
window.addEventListener('pointerleave', () => gameState.mouseDown = false);

window.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'Enter':
      if (gameState.editingEl && event.target.closest('.article')) {
        doSearch(gameState.editingEl);
      }
      break;
    case '1':
      setCurrentPlayer(0);
      break;
    case '2':
      setCurrentPlayer(1);
      break;
    case '3':
      setCurrentPlayer(2);
      break;
    case '4':
      setCurrentPlayer(3);
      break
    case 'ArrowUp':
      if (document.activeElement !== ySlider) {
        gameState.playerPositions[gameState.currentPlayer].y += 1;
        setPlayerPosition(gameState.currentPlayer, gameState.playerPositions[gameState.currentPlayer].x, gameState.playerPositions[gameState.currentPlayer].y);
        event.preventDefault();
      }
      ySlider.focus();
      break;
    case 'ArrowDown':
      if (document.activeElement !== ySlider) {
        gameState.playerPositions[gameState.currentPlayer].y -= 1;
        setPlayerPosition(gameState.currentPlayer, gameState.playerPositions[gameState.currentPlayer].x, gameState.playerPositions[gameState.currentPlayer].y);
        event.preventDefault();
      }
      ySlider.focus();
      break;
    case 'ArrowLeft':
      if (document.activeElement !== xSlider) {
        gameState.playerPositions[gameState.currentPlayer].x -= 1;
        setPlayerPosition(gameState.currentPlayer, gameState.playerPositions[gameState.currentPlayer].x, gameState.playerPositions[gameState.currentPlayer].y);
        event.preventDefault();
      }
      xSlider.focus();
      break;
    case 'ArrowRight':
      if (document.activeElement !== xSlider) {
        gameState.playerPositions[gameState.currentPlayer].x += 1;
        setPlayerPosition(gameState.currentPlayer, gameState.playerPositions[gameState.currentPlayer].x, gameState.playerPositions[gameState.currentPlayer].y);
        event.preventDefault();
      }
      xSlider.focus();
      break
  }
});

gameEl.addEventListener('click', (event) => {
  if (event.target.closest('.article-edit')) {
    toggleEditMode(event.target.closest('.article'));
  }
  else if (event.target.closest('.article-random')) {
    replaceWithRandom(event.target.closest('.article'));
  }
  else if (!event.target.closest('.article')) {
    handleMouseEvent(event);
  }
});

window.addEventListener('pointermove', (event) => {
  if (gameState.mouseDown) {
    handleMouseEvent(event);
  }
});

window.addEventListener('resize', (event) => {
  for (let player = 0; player < gameState.playerPositions.length; player++) {
    setPlayerPosition(player, gameState.playerPositions[player].x, gameState.playerPositions[player].y);
  }
});

refreshButton.addEventListener('click', (event) => {
  event.stopPropagation();
  printArticles();
});

// Start
printArticles();
