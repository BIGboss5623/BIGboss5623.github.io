param(
    [Parameter(Mandatory = $true)][string]$InputZip,
    [Parameter(Mandatory = $true)][string]$OutputJson
)

$securePassword = Read-Host "Configuration password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

if ([string]::IsNullOrWhiteSpace($password)) { throw "Password cannot be empty." }

$salt = New-Object byte[] 16
$iv = New-Object byte[] 16
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($salt)
$rng.GetBytes($iv)
$iterations = 250000
$derive = New-Object Security.Cryptography.Rfc2898DeriveBytes(
    $password,
    $salt,
    $iterations,
    [Security.Cryptography.HashAlgorithmName]::SHA256
)
$keyMaterial = $derive.GetBytes(64)
$encryptionKey = $keyMaterial[0..31]
$authenticationKey = $keyMaterial[32..63]

$aes = [Security.Cryptography.Aes]::Create()
$aes.Mode = [Security.Cryptography.CipherMode]::CBC
$aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
$aes.Key = $encryptionKey
$aes.IV = $iv
$plainBytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $InputZip))
$encryptor = $aes.CreateEncryptor()
$ciphertext = $encryptor.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)

$authenticatedBytes = New-Object byte[] ($iv.Length + $ciphertext.Length)
[Array]::Copy($iv, 0, $authenticatedBytes, 0, $iv.Length)
[Array]::Copy($ciphertext, 0, $authenticatedBytes, $iv.Length, $ciphertext.Length)
$hmac = New-Object Security.Cryptography.HMACSHA256 -ArgumentList (, $authenticationKey)
$tag = $hmac.ComputeHash($authenticatedBytes)

$payload = [ordered]@{
    algorithm = "AES-CBC-HMAC-SHA256"
    kdf = "PBKDF2-SHA256"
    iterations = $iterations
    salt = [Convert]::ToBase64String($salt)
    iv = [Convert]::ToBase64String($iv)
    ciphertext = [Convert]::ToBase64String($ciphertext)
    tag = [Convert]::ToBase64String($tag)
    filename = "ZeroTier-auto-config.zip"
}
$payload | ConvertTo-Json -Compress | Set-Content -LiteralPath $OutputJson -Encoding UTF8
Write-Host "Encrypted configuration created: $OutputJson"

$password = $null
[Array]::Clear($keyMaterial, 0, $keyMaterial.Length)
[Array]::Clear($encryptionKey, 0, $encryptionKey.Length)
[Array]::Clear($authenticationKey, 0, $authenticationKey.Length)
