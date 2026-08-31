// ==========================================
// ESTADO GLOBAL Y MAPEO DE IMÁGENES SVG
// ==========================================
const PIECE_IMAGES = {
  'wP': 'img/wP.svg', 'wR': 'img/wR.svg', 'wN': 'img/wN.svg',
  'wB': 'img/wB.svg', 'wQ': 'img/wQ.svg', 'wK': 'img/wK.svg',
  'bP': 'img/bP.svg', 'bR': 'img/bR.svg', 'bN': 'img/bN.svg',
  'bB': 'img/bB.svg', 'bQ': 'img/bQ.svg', 'bK': 'img/bK.svg'
};

const WHITE_PIECES = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK'];
const BLACK_PIECES = ['bP', 'bR', 'bN', 'bB', 'bQ', 'bK'];

const initialBoard = [
  ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
  ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
  ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
];

let boardState = structuredClone(initialBoard);
let selectedSquare = null;
let turn = 'white';

let hasMoved = {
  whiteKing: false, blackKing: false,
  whiteRookK: false, whiteRookQ: false,
  blackRookK: false, blackRookQ: false
};
let enPassantTarget = null;

function getPieceColor(piece) {
  if (!piece) return null;
  return WHITE_PIECES.includes(piece) ? 'white' : 'black';
}

// ==========================================
// REGLAS DE MOVIMIENTO
// ==========================================

// 1. PEÓN
function isValidPawnMove(from, to, piece) {
  const color = getPieceColor(piece);
  const direction = color === 'white' ? -1 : 1;
  const startRow = color === 'white' ? 6 : 1;
  const targetPiece = boardState[to.row][to.col];

  const rowDiff = to.row - from.row;
  const colDiff = Math.abs(to.col - from.col);

  // Avance 1 casilla
  if (colDiff === 0 && rowDiff === direction && !targetPiece) return true;

  // Avance doble inicial
  if (colDiff === 0 && from.row === startRow && rowDiff === 2 * direction) {
    const middleRow = from.row + direction;
    if (!boardState[middleRow][from.col] && !targetPiece) return true;
  }

  // Captura diagonal normal
  if (colDiff === 1 && rowDiff === direction && targetPiece && getPieceColor(targetPiece) !== color) {
    return true;
  }

  // Peón al Paso (En Passant)
  if (colDiff === 1 && rowDiff === direction && !targetPiece && enPassantTarget) {
    if (to.row === enPassantTarget.row && to.col === enPassantTarget.col) {
      return true;
    }
  }

  return false;
}

function getLegalMovesForSquare(from) {
  const legalMoves = [];
  if (!from) return legalMoves;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isMoveLegal(from, { row: r, col: c })) {
        legalMoves.push({ row: r, col: c });
      }
    }
  }
  return legalMoves;
}

// 2. REY (Con validación estricta de Enroque sin Jaque)
function isValidKingMove(from, to, piece) {
  const color = getPieceColor(piece);
  const rowDiff = Math.abs(to.row - from.row);
  const colDiff = Math.abs(to.col - from.col);

  // Movimiento normal de 1 casilla
  if (rowDiff <= 1 && colDiff <= 1) return true;

  // Enroque (2 casillas en horizontal)
  if (rowDiff === 0 && (to.col - from.col === 2 || to.col - from.col === -2)) {
    const enemyColor = color === 'white' ? 'black' : 'white';

    // No puede enrocar si está en jaque actualmente
    if (isSquareAttacked(from, enemyColor)) return false;

    const isKingSide = to.col > from.col;

    if (color === 'white') {
      if (hasMoved.whiteKing) return false;
      if (isKingSide) {
        if (hasMoved.whiteRookK || !isPathClear(from, {row: 7, col: 7})) return false;
        if (isSquareAttacked({row: 7, col: 5}, enemyColor)) return false; // Casilla de paso
      } else {
        if (hasMoved.whiteRookQ || !isPathClear(from, {row: 7, col: 0})) return false;
        if (isSquareAttacked({row: 7, col: 3}, enemyColor)) return false; // Casilla de paso
      }
    } else {
      if (hasMoved.blackKing) return false;
      if (isKingSide) {
        if (hasMoved.blackRookK || !isPathClear(from, {row: 0, col: 7})) return false;
        if (isSquareAttacked({row: 0, col: 5}, enemyColor)) return false; // Casilla de paso
      } else {
        if (hasMoved.blackRookQ || !isPathClear(from, {row: 0, col: 0})) return false;
        if (isSquareAttacked({row: 0, col: 3}, enemyColor)) return false; // Casilla de paso
      }
    }
    return true;
  }

  return false;
}

function isValidRookMove(from, to) { return (from.row === to.row || from.col === to.col) && isPathClear(from, to); }
function isValidKnightMove(from, to) { const r = Math.abs(to.row - from.row), c = Math.abs(to.col - from.col); return (r === 2 && c === 1) || (r === 1 && c === 2); }
function isValidBishopMove(from, to) { return Math.abs(to.row - from.row) === Math.abs(to.col - from.col) && isPathClear(from, to); }
function isValidQueenMove(from, to) { return (isValidRookMove(from, to) || isValidBishopMove(from, to)); }

function isPathClear(from, to) {
  const rowStep = Math.sign(to.row - from.row);
  const colStep = Math.sign(to.col - from.col);
  let currentRow = from.row + rowStep;
  let currentCol = from.col + colStep;

  while (currentRow !== to.row || currentCol !== to.col) {
    if (boardState[currentRow][currentCol] !== null) return false;
    currentRow += rowStep;
    currentCol += colStep;
  }
  return true;
}

function isMoveValid(from, to) {
  const piece = boardState[from.row][from.col];
  const targetPiece = boardState[to.row][to.col];
  const pieceColor = getPieceColor(piece);

  if (targetPiece && getPieceColor(targetPiece) === pieceColor) return false;

  switch (piece) {
    case 'wP': case 'bP': return isValidPawnMove(from, to, piece);
    case 'wR': case 'bR': return isValidRookMove(from, to);
    case 'wN': case 'bN': return isValidKnightMove(from, to);
    case 'wB': case 'bB': return isValidBishopMove(from, to);
    case 'wQ': case 'bQ': return isValidQueenMove(from, to);
    case 'wK': case 'bK': return isValidKingMove(from, to, piece);
    default: return false;
  }
}

// ==========================================
// EJECUCIÓN DEL MOVIMIENTO Y REGLAS ESPECIALES
// ==========================================
function executeMove(from, to) {
  const piece = boardState[from.row][from.col];
  const color = getPieceColor(piece);

  // 1. Manejo de Enroque
  if ((piece === 'wK' || piece === 'bK') && Math.abs(to.col - from.col) === 2) {
    const isKingSide = to.col > from.col;
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? 5 : 3;

    boardState[from.row][rookToCol] = boardState[from.row][rookFromCol];
    boardState[from.row][rookFromCol] = null;
  }

  // 2. Manejo de Peón al Paso
  if ((piece === 'wP' || piece === 'bP') && enPassantTarget) {
    if (to.row === enPassantTarget.row && to.col === enPassantTarget.col) {
      const capturedPawnRow = color === 'white' ? to.row + 1 : to.row - 1;
      boardState[capturedPawnRow][to.col] = null;
    }
  }

  // Actualización del tablero
  boardState[to.row][to.col] = piece;
  boardState[from.row][from.col] = null;

  // 3. Actualizar Peón al Paso para el siguiente turno
  if ((piece === 'wP' || piece === 'bP') && Math.abs(to.row - from.row) === 2) {
    const targetRow = color === 'white' ? from.row - 1 : from.row + 1;
    enPassantTarget = { row: targetRow, col: from.col };
  } else {
    enPassantTarget = null;
  }

  // 4. Promoción del Peón
  if (piece === 'wP' && to.row === 0) boardState[to.row][to.col] = 'wQ';
  if (piece === 'bP' && to.row === 7) boardState[to.row][to.col] = 'bQ';

  // 5. Registrar movimientos de Torres y Reyes
  if (from.row === 7 && from.col === 4) hasMoved.whiteKing = true;
  if (from.row === 0 && from.col === 4) hasMoved.blackKing = true;
  if (from.row === 7 && from.col === 7) hasMoved.whiteRookK = true;
  if (from.row === 7 && from.col === 0) hasMoved.whiteRookQ = true;
  if (from.row === 0 && from.col === 7) hasMoved.blackRookK = true;
  if (from.row === 0 && from.col === 0) hasMoved.blackRookQ = true;

  turn = turn === 'white' ? 'black' : 'white';
}

// ==========================================
// LÓGICA DE JAQUE Y DETECCIÓN DE AMENAZAS
// ==========================================
function findKing(color) {
  const kingSymbol = color === 'white' ? 'wK' : 'bK';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (boardState[r][c] === kingSymbol) return { row: r, col: c };
    }
  }
  return null;
}

function isSquareAttacked(square, attackerColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = boardState[r][c];
      if (piece && getPieceColor(piece) === attackerColor) {
        if (isMoveValid({ row: r, col: c }, square)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isKingInCheck(color) {
  const kingSquare = findKing(color);
  if (!kingSquare) return false;
  const enemyColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(kingSquare, enemyColor);
}

// ==========================================
// SIMULACIÓN Y VALIDACIÓN DE LEGALIDAD
// ==========================================
function isMoveLegal(from, to) {
  if (!isMoveValid(from, to)) return false;

  const color = getPieceColor(boardState[from.row][from.col]);
  const originalFromPiece = boardState[from.row][from.col];
  const originalToPiece = boardState[to.row][to.col];

  // Simulación del movimiento
  boardState[to.row][to.col] = originalFromPiece;
  boardState[from.row][from.col] = null;

  const inCheck = isKingInCheck(color);

  // Restaurar estado
  boardState[from.row][from.col] = originalFromPiece;
  boardState[to.row][to.col] = originalToPiece;

  return !inCheck;
}

function hasAnyLegalMove(color) {
  for (let fromR = 0; fromR < 8; fromR++) {
    for (let fromC = 0; fromC < 8; fromC++) {
      const piece = boardState[fromR][fromC];
      if (piece && getPieceColor(piece) === color) {
        for (let toR = 0; toR < 8; toR++) {
          for (let toC = 0; toC < 8; toC++) {
            if (isMoveLegal({ row: fromR, col: fromC }, { row: toR, col: toC })) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function checkGameStatus() {
  const inCheck = isKingInCheck(turn);
  const movesAvailable = hasAnyLegalMove(turn);

  if (inCheck && !movesAvailable) {
    alert(`¡Jaque Mate! Ganaron las ${turn === 'white' ? 'Negras' : 'Blancas'}.`);
  } else if (!inCheck && !movesAvailable) {
    alert('¡Tablas por Ahogado! No hay movimientos legales.');
  } else if (inCheck) {
    console.log(`¡El rey ${turn} está en Jaque!`);
  }
}

// ==========================================
// RENDERIZADO SVG Y EVENTOS
// ==========================================
function drawBoard() {
  const boardElement = document.getElementById('board');
  if (!boardElement) return;
  boardElement.innerHTML = '';

  // Obtener todos los movimientos válidos de la pieza seleccionada
  const validMoves = selectedSquare ? getLegalMovesForSquare(selectedSquare) : [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      const isLight = (row + col) % 2 === 0;
      square.className = `square ${isLight ? 'light' : 'dark'}`;

      if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
        square.classList.add('selected');
      }

      // Dibujar pieza si existe
      const piece = boardState[row][col];
      if (piece) {
        const img = document.createElement('img');
        img.src = PIECE_IMAGES[piece];
        img.alt = piece;
        img.className = 'piece-img';
        square.appendChild(img);
      }

      // Comprobar si esta casilla es un destino válido
      const isPossibleMove = validMoves.some(m => m.row === row && m.col === col);
      if (isPossibleMove) {
        const dot = document.createElement('div');
        dot.className = 'move-dot';
        square.appendChild(dot);
      }

      square.addEventListener('click', () => handleSquareClick(row, col));
      boardElement.appendChild(square);
    }
  }
}

function handleSquareClick(row, col) {
  const clickedPiece = boardState[row][col];

  if (!selectedSquare) {
    if (clickedPiece && getPieceColor(clickedPiece) === turn) {
      selectedSquare = { row, col };
    }
  } else {
    if (selectedSquare.row === row && selectedSquare.col === col) {
      selectedSquare = null;
    } else if (isMoveLegal(selectedSquare, { row, col })) {
      executeMove(selectedSquare, { row, col });
      selectedSquare = null;
      checkGameStatus();
    } else if (clickedPiece && getPieceColor(clickedPiece) === turn) {
      selectedSquare = { row, col };
    }
  }
  drawBoard();
}

document.addEventListener('DOMContentLoaded', drawBoard);
