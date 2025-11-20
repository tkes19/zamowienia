<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Docelowa lokalizacja katalogu z miejscowościami na QNAP-ie
// Poprzednio używana ścieżka UNC (Windows): \\\\192.168.0.30\\Web\\home\\PROJEKTY_MIEJSCOWOŚCI
$REMOTE_DIR = '/share/CACHEDEV1_DATA/Web/home/PROJEKTY_MIEJSCOWOŚCI';

if (!is_dir($REMOTE_DIR)) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Base directory not found',
    'path' => $REMOTE_DIR
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$baseReal = realpath($REMOTE_DIR);
if ($baseReal === false) {
  // realpath może zwrócić false dla ścieżek UNC – użyj oryginalnej
  $baseReal = rtrim($REMOTE_DIR, DIRECTORY_SEPARATOR);
}

$entries = scandir($baseReal);
if ($entries === false) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Unable to read directory contents',
    'path' => $baseReal
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$cities = array_values(array_filter($entries, function($name) use ($baseReal) {
  if ($name === '.' || $name === '..' || $name === '') return false;
  $full = $baseReal . DIRECTORY_SEPARATOR . $name;
  return is_dir($full);
}));

setlocale(LC_COLLATE, 'pl_PL.UTF-8');
usort($cities, 'strcoll');

echo json_encode([
  'count' => count($cities),
  'cities' => $cities,
  'source' => $baseReal
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
