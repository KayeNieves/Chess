const boardElement = document.getElementById("board");
const statusText = document.getElementById("status");
const newGameBtn = document.getElementById("new-game-btn");
const timeSelect = document.getElementById("time-control");
const whiteClock = document.getElementById("white-clock");
const blackClock = document.getElementById("black-clock");
const whiteBar = document.getElementById("white-bar");
const blackBar = document.getElementById("black-bar");

const symbols = {
  K: "♚",
  Q: "♛",
  R: "♜",
  B: "♝",
  N: "♞",
  P: "♟"
};

let board;
let turn;
let selected;
let legalMoves;
let gameOver;

let timeLeft = { w: 0, b: 0 };
let increment = 0;
let clockStarted = false;
let lastTick = 0;
let timerId = null;
let moveCount = 0;

function createBoard() {
  return [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
  ];
}

function isInside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function getPseudoMoves(b, row, col) {
  const piece = b[row][col];
  const color = piece[0];
  const type = piece[1];
  const enemy = color === "w" ? "b" : "w";
  const moves = [];

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;

    if (isInside(row + dir, col) && b[row + dir][col] === "") {
      moves.push([row + dir, col]);
      if (row === startRow && b[row + 2 * dir][col] === "") {
        moves.push([row + 2 * dir, col]);
      }
    }

    for (const dc of [-1, 1]) {
      const nr = row + dir;
      const nc = col + dc;
      if (isInside(nr, nc) && b[nr][nc] !== "" && b[nr][nc][0] === enemy) {
        moves.push([nr, nc]);
      }
    }
  }
  else if (type === "N" || type === "K") {
    const steps = type === "N"
      ? [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
      : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    for (const [dr, dc] of steps) {
      const nr = row + dr;
      const nc = col + dc;
      if (isInside(nr, nc) && (b[nr][nc] === "" || b[nr][nc][0] === enemy)) {
        moves.push([nr, nc]);
      }
    }
  }
  else {
    const straight = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const diagonal = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    let directions = [];

    if (type === "R") directions = straight;
    else if (type === "B") directions = diagonal;
    else directions = straight.concat(diagonal);

    for (const [dr, dc] of directions) {
      let nr = row + dr;
      let nc = col + dc;

      while (isInside(nr, nc)) {
        if (b[nr][nc] === "") {
          moves.push([nr, nc]);
        }
        else {
          if (b[nr][nc][0] === enemy) moves.push([nr, nc]);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  return moves;
}

function findKing(b, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] === color + "K") return [r, c];
    }
  }
  return null;
}

function isInCheck(b, color) {
  const king = findKing(b, color);
  if (king === null) return false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] !== "" && b[r][c][0] !== color) {
        const attacks = getPseudoMoves(b, r, c);
        if (attacks.some(m => m[0] === king[0] && m[1] === king[1])) return true;
      }
    }
  }
  return false;
}

function getLegalMoves(row, col) {
  const color = board[row][col][0];

  return getPseudoMoves(board, row, col).filter(function (move) {
    const copy = board.map(r => r.slice());
    copy[move[0]][move[1]] = copy[row][col];
    copy[row][col] = "";
    return !isInCheck(copy, color);
  });
}

function hasAnyLegalMove(color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== "" && board[r][c][0] === color) {
        if (getLegalMoves(r, c).length > 0) return true;
      }
    }
  }
  return false;
}

function hasMatingMaterial(color) {
  let minorPieces = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece !== "" && piece[0] === color) {
        if (piece[1] === "P" || piece[1] === "R" || piece[1] === "Q") return true;
        if (piece[1] === "N" || piece[1] === "B") minorPieces++;
      }
    }
  }
  return minorPieces >= 2;
}

function colorName(color) {
  return color === "w" ? "White" : "Black";
}

function formatTime(ms) {
  if (ms <= 0) return "0:00.0";

  if (ms < 10000) {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return "0:0" + seconds + "." + tenths;
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

function updateClocks() {
  whiteClock.textContent = formatTime(timeLeft.w);
  blackClock.textContent = formatTime(timeLeft.b);

  whiteClock.className = "clock" + (timeLeft.w < 10000 ? " low" : "");
  blackClock.className = "clock" + (timeLeft.b < 10000 ? " low" : "");

  whiteBar.className = "player-bar bottom" + (!gameOver && turn === "w" ? " active" : "");
  blackBar.className = "player-bar top" + (!gameOver && turn === "b" ? " active" : "");

  timeSelect.disabled = moveCount > 0 && !gameOver;
}

function startClock() {
  lastTick = Date.now();
  if (timerId === null) {
    timerId = setInterval(checkTime, 100);
  }
}

function stopClock() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function checkTime() {
  if (!clockStarted || gameOver) return false;

  const now = Date.now();
  timeLeft[turn] -= now - lastTick;
  lastTick = now;

  if (timeLeft[turn] > 0) {
    updateClocks();
    return false;
  }

  timeLeft[turn] = 0;
  gameOver = true;
  stopClock();
  selected = null;
  legalMoves = [];

  const winner = turn === "w" ? "b" : "w";
  if (hasMatingMaterial(winner)) {
    statusText.textContent = "Time's up! " + colorName(winner) + " wins.";
  }
  else {
    statusText.textContent = "Time's up! Draw (not enough material to checkmate).";
  }

  updateClocks();
  render();
  return true;
}

function updateStatus() {
  const inCheck = isInCheck(board, turn);

  if (!hasAnyLegalMove(turn)) {
    gameOver = true;
    if (inCheck) {
      statusText.textContent = "Checkmate! " + colorName(turn === "w" ? "b" : "w") + " wins.";
    }
    else {
      statusText.textContent = "Stalemate. It's a draw.";
    }
  }
  else if (inCheck) {
    statusText.textContent = colorName(turn) + "'s turn (check)";
  }
  else {
    statusText.textContent = colorName(turn) + "'s turn";
  }
}

function movePiece(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  const mover = turn;

  if (clockStarted) {
    timeLeft[mover] += increment;
  }

  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = "";

  if (piece[1] === "P" && (toRow === 0 || toRow === 7)) {
    board[toRow][toCol] = piece[0] + "Q";
  }

  selected = null;
  legalMoves = [];
  turn = turn === "w" ? "b" : "w";
  moveCount++;
  updateStatus();

  if (gameOver) {
    stopClock();
  }
  else if (!clockStarted && mover === "w") {
    clockStarted = true;
    startClock();
  }

  updateClocks();
}

function onSquareClick(row, col) {
  if (gameOver) return;
  if (checkTime()) return;

  if (selected !== null) {
    const isLegal = legalMoves.some(m => m[0] === row && m[1] === col);
    if (isLegal) {
      movePiece(selected[0], selected[1], row, col);
      render();
      return;
    }
  }

  if (board[row][col] !== "" && board[row][col][0] === turn) {
    selected = [row, col];
    legalMoves = getLegalMoves(row, col);
  }
  else {
    selected = null;
    legalMoves = [];
  }
  render();
}

function render() {
  boardElement.innerHTML = "";

  const kingInCheck = isInCheck(board, turn) ? findKing(board, turn) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      let classes = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      if (selected !== null && selected[0] === r && selected[1] === c) {
        classes += " selected";
      }

      if (legalMoves.some(m => m[0] === r && m[1] === c)) {
        classes += board[r][c] === "" ? " move" : " capture";
      }

      if (kingInCheck !== null && kingInCheck[0] === r && kingInCheck[1] === c) {
        classes += " in-check";
      }

      square.className = classes;

      if (board[r][c] !== "") {
        const piece = document.createElement("span");
        piece.className = "piece " + (board[r][c][0] === "w" ? "white" : "black");
        piece.textContent = symbols[board[r][c][1]] + "\uFE0E";
        square.appendChild(piece);
      }

      square.addEventListener("click", function () {
        onSquareClick(r, c);
      });

      boardElement.appendChild(square);
    }
  }
}

function newGame() {
  const settings = timeSelect.value.split(",");
  const startTime = Number(settings[0]) * 1000;
  increment = Number(settings[1]) * 1000;

  stopClock();
  clockStarted = false;
  moveCount = 0;
  timeLeft = { w: startTime, b: startTime };

  board = createBoard();
  turn = "w";
  selected = null;
  legalMoves = [];
  gameOver = false;

  updateStatus();
  updateClocks();
  render();
}

newGameBtn.addEventListener("click", newGame);
timeSelect.addEventListener("change", newGame);

newGame();