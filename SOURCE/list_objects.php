<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Katalog bazowy z handlowcami (każdy handlowiec ma podfoldery obiektów)
// Odpowiada \\192.168.0.30\Web\home\PROJEKTY_MIEJSCOWOŚCI\02. KLIENCI INDYWIDUALNI
$REMOTE_DIR = '/share/CACHEDEV1_DATA/Web/home/PROJEKTY_MIEJSCOWOŚCI/02. KLIENCI INDYWIDUALNI';

$salesperson = isset($_GET['salesperson']) ? $_GET['salesperson'] : '';

if ($salesperson === '') {
  http_response_code(400);
  echo json_encode(['error' => 'Missing salesperson'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

// Prosta walidacja nazwy handlowca (bez podchodzenia wyżej w katalogach)
if (strpos($salesperson, '..') !== false) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid salesperson name'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

if (!is_dir($REMOTE_DIR)) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Base directory not found',
    'path' => $REMOTE_DIR,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$baseReal = realpath($REMOTE_DIR);
if ($baseReal === false) {
  $baseReal = rtrim($REMOTE_DIR, DIRECTORY_SEPARATOR);
}

$rootPath = rtrim($baseReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $salesperson;

if (!is_dir($rootPath)) {
  http_response_code(404);
  echo json_encode([
    'error' => 'Salesperson not found',
    'salesperson' => $salesperson,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$entries = scandir($rootPath);
if ($entries === false) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Unable to read directory contents',
    'path' => $rootPath,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$objects = array_values(array_filter($entries, function ($name) use ($rootPath) {
  if ($name === '.' || $name === '..' || $name === '') return false;
  $full = $rootPath . DIRECTORY_SEPARATOR . $name;
  return is_dir($full);
}));

setlocale(LC_COLLATE, 'pl_PL.UTF-8');
usort($objects, 'strcoll');

echo json_encode([
  'salesperson' => $salesperson,
  'count' => count($objects),
  'objects' => $objects,
  'source' => $rootPath,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
