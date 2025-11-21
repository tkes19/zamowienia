<?php
// list_products_object.php?salesperson=NAZWA&object=OBIEKT
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Katalog bazowy dla trybu "Klienci indywidualni"
// Odpowiada \\192.168.0.30\Web\home\PROJEKTY_MIEJSCOWOŚCI\02. KLIENCI INDYWIDUALNI
$REMOTE_DIR  = '/share/CACHEDEV1_DATA/Web/home/PROJEKTY_MIEJSCOWOŚCI/02. KLIENCI INDYWIDUALNI';
$PUBLIC_BASE = 'http://192.168.0.30:81/home/PROJEKTY_MIEJSCOWOŚCI/02. KLIENCI INDYWIDUALNI';

const ALLOWED_EXT = ['jpg','jpeg','png','webp','gif'];

function normalize_for_filename(string $s): string {
    $s = str_replace([' ', '-'], '_', $s);
    $s = preg_replace('/_{2,}/', '_', $s);
    $s = trim($s, '_');
    return mb_strtolower($s, 'UTF-8');
}

function is_image_file(string $dir, string $file): bool {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    return is_file($dir . DIRECTORY_SEPARATOR . $file) && in_array($ext, ALLOWED_EXT, true);
}

$salesperson = isset($_GET['salesperson']) ? $_GET['salesperson'] : '';
$object      = isset($_GET['object']) ? $_GET['object'] : '';

if ($salesperson === '' || $object === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing salesperson or object'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Prosta walidacja parametrów (bez wychodzenia wyżej w katalogach)
if (strpos($salesperson, '..') !== false || strpos($object, '..') !== false) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid salesperson or object'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!is_dir($REMOTE_DIR)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Base directory not found',
        'path'  => $REMOTE_DIR,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$baseReal = realpath($REMOTE_DIR);
if ($baseReal === false) {
    $baseReal = rtrim($REMOTE_DIR, DIRECTORY_SEPARATOR);
}

$path = rtrim($baseReal, DIRECTORY_SEPARATOR)
    . DIRECTORY_SEPARATOR . $salesperson
    . DIRECTORY_SEPARATOR . $object;

if (!is_dir($path)) {
    http_response_code(404);
    echo json_encode([
        'error'       => 'Object not found',
        'salesperson' => $salesperson,
        'object'      => $object,
        'path'        => $path,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$normFolder = normalize_for_filename($object);
$entries    = scandir($path);

$productsSet = [];
$filesOut    = [];
$errors      = [];

foreach ($entries as $f) {
    if ($f === '.' || $f === '..') continue;
    if (!is_image_file($path, $f)) continue;

    $nameNoExt = pathinfo($f, PATHINFO_FILENAME);
    $normFile  = normalize_for_filename($nameNoExt);
    $expectedPrefix = $normFolder . '_';

    if (strpos($normFile, $expectedPrefix) === 0) {
        $underscorePos = mb_strpos($nameNoExt, '_');
        if ($underscorePos === false) {
            $errors[] = ['file' => $f, 'reason' => 'Missing underscore in original filename'];
            continue;
        }
        $productSlug = trim(mb_substr($normFile, mb_strlen($expectedPrefix)), '_');
        if ($productSlug === '') {
            $errors[] = ['file' => $f, 'reason' => 'Empty product name'];
            continue;
        }
        $productsSet[$productSlug] = true;
        $filesOut[] = [
            'file'    => $f,
            'product' => $productSlug,
            'url'     => $PUBLIC_BASE
                . '/' . rawurlencode($salesperson)
                . '/' . rawurlencode($object)
                . '/' . rawurlencode($f),
        ];
    } else {
        $errors[] = [
            'file'                => $f,
            'reason'              => 'Filename does not start with normalized folder name + underscore',
            'expected_prefix'     => $expectedPrefix,
            'normalized_filename' => $normFile,
        ];
    }
}

$products = array_keys($productsSet);
setlocale(LC_COLLATE, 'pl_PL.UTF-8');
usort($products, 'strcoll');

echo json_encode([
    'salesperson'     => $salesperson,
    'object'          => $object,
    'normalizedObject'=> $normFolder,
    'product_count'   => count($products),
    'products'        => $products,
    'files'           => $filesOut,
    'errors'          => $errors,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
