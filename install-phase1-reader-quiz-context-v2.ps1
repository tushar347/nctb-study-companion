$ErrorActionPreference = "Stop"

$ProjectRoot = "D:\nctb-study-companion-starter"
$ReaderPath = Join-Path $ProjectRoot "app\reader\page.tsx"
$QuizPath = Join-Path $ProjectRoot "app\quiz\page.tsx"
$ContextPath = Join-Path $ProjectRoot "lib\quiz\quizLaunchContext.ts"

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json"))) {
    throw "Project not found at $ProjectRoot"
}

if (-not (Test-Path -LiteralPath $ReaderPath)) {
    throw "Reader file not found: $ReaderPath"
}

if (-not (Test-Path -LiteralPath $QuizPath)) {
    throw "Quiz file not found: $QuizPath"
}

Set-Location $ProjectRoot

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "backups\phase1-quiz-context-v2-$Timestamp"

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $ContextPath) -Force | Out-Null

Copy-Item -LiteralPath $ReaderPath -Destination (Join-Path $BackupRoot "reader-page.tsx") -Force
Copy-Item -LiteralPath $QuizPath -Destination (Join-Path $BackupRoot "quiz-page.tsx") -Force

if (Test-Path -LiteralPath $ContextPath) {
    Copy-Item -LiteralPath $ContextPath -Destination (Join-Path $BackupRoot "quizLaunchContext.ts") -Force
}

function Normalize-Lf {
    param([string]$Value)

    return $Value.Replace("`r`n", "`n").Replace("`r", "`n")
}

function ConvertFrom-Base64Utf8 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Encoded
    )

    $clean = $Encoded -replace '\s', ''
    $bytes = [System.Convert]::FromBase64String($clean)

    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Replace-ExactOnce {
    param(
        [string]$Content,
        [string]$OldValue,
        [string]$NewValue,
        [string]$Label
    )

    $count = ([regex]::Matches(
        $Content,
        [regex]::Escape($OldValue)
    )).Count

    if ($count -ne 1) {
        throw "$Label expected exactly one source match, but found $count. No project files were written."
    }

    return $Content.Replace($OldValue, $NewValue)
}

function Replace-RegexOnce {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Label
    )

    $regex = [regex]::new(
        $Pattern,
        ([System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::Multiline)
    )

    $matches = $regex.Matches($Content)

    if ($matches.Count -ne 1) {
        throw "$Label expected exactly one source match, but found $($matches.Count). No project files were written."
    }

    return $regex.Replace(
        $Content,
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($match)
            return $Replacement
        },
        1
    )
}

$Reader = Normalize-Lf ([System.IO.File]::ReadAllText($ReaderPath))
$Quiz = Normalize-Lf ([System.IO.File]::ReadAllText($QuizPath))

$ReaderImportBase64 = @'
aW1wb3J0IHsKICBidWlsZFF1aXpIcmVmLAogIGNyZWF0ZVF1aXpMYXVuY2hDb250ZXh0LAogIHdyaXRlUXVpekxhdW5jaENvbnRleHQsCn0gZnJvbSAiQC9saWIvcXVpei9xdWl6TGF1bmNoQ29udGV4dCI7Cg==
'@

$ReaderImport = Normalize-Lf (
    ConvertFrom-Base64Utf8 $ReaderImportBase64
)

$ReaderFunctionsBase64 = @'
ICBmdW5jdGlvbiBwZXJzaXN0TGVnYWN5UXVpelNlbGVjdGlvbigKICAgIGxpbmU6IE9DUkxpbmUgfCBudWxsLAogICkgewogICAgY29uc3QgbGVzc29uID0KICAgICAgYm9va0lkID09PSAiY2xhc3M2LWVuZ2xpc2giCiAgICAgICAgPyBnZXRMZXNzb25Gb3JQYWdlKHBhZ2VOdW1iZXIpCiAgICAgICAgOiBudWxsOwoKICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKAogICAgICAic2VsZWN0ZWRDbGFzcyIsCiAgICAgIFN0cmluZyhjdXJyZW50Qm9vay5jbGFzc0xldmVsKSwKICAgICk7CgogICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oCiAgICAgICJzZWxlY3RlZEJvb2tJZCIsCiAgICAgIGN1cnJlbnRCb29rLmlkLAogICAgKTsKCiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgKICAgICAgInNlbGVjdGVkQm9va1RpdGxlIiwKICAgICAgY3VycmVudEJvb2sudGl0bGUsCiAgICApOwoKICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKAogICAgICAic2VsZWN0ZWRCb29rUGRmUGFnZSIsCiAgICAgIFN0cmluZyhwYWdlTnVtYmVyKSwKICAgICk7CgogICAgaWYgKGxpbmUpIHsKICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oCiAgICAgICAgInNlbGVjdGVkTGluZSIsCiAgICAgICAgbGluZS5jbGVhblRleHQgPz8gbGluZS50ZXh0LAogICAgICApOwogICAgfSBlbHNlIHsKICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oCiAgICAgICAgInNlbGVjdGVkTGluZSIsCiAgICAgICk7CiAgICB9CgogICAgaWYgKGxlc3NvbikgewogICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgKICAgICAgICAic2VsZWN0ZWRMZXNzb25ObyIsCiAgICAgICAgU3RyaW5nKGxlc3Nvbi5sZXNzb25ObyksCiAgICAgICk7CgogICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgKICAgICAgICAic2VsZWN0ZWRMZXNzb25UaXRsZSIsCiAgICAgICAgbGVzc29uLnRpdGxlLAogICAgICApOwogICAgfSBlbHNlIHsKICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oCiAgICAgICAgInNlbGVjdGVkTGVzc29uTm8iLAogICAgICApOwoKICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oCiAgICAgICAgInNlbGVjdGVkTGVzc29uVGl0bGUiLAogICAgICAgICJMZXNzb24gbWFwcGluZyB1bmF2YWlsYWJsZSIsCiAgICAgICk7CiAgICB9CiAgfQoKCiAgZnVuY3Rpb24gc2VsZWN0Qm9va0xpbmUoCiAgICBsaW5lOiBPQ1JMaW5lLAogICkgewogICAgc2V0U2VsZWN0ZWRMaW5lKGxpbmUpOwogICAgc2V0VGVhY2hlclJlc3BvbnNlKCIiKTsKICAgIHNldFRlYWNoZXJFcnJvcigiIik7CgogICAgcGVyc2lzdExlZ2FjeVF1aXpTZWxlY3Rpb24obGluZSk7CiAgfQoKCiAgZnVuY3Rpb24gYnVpbGRDdXJyZW50UXVpekNvbnRleHQoCiAgICBsaW5lOiBPQ1JMaW5lIHwgbnVsbCwKICApIHsKICAgIGlmICghcGFnZURhdGEpIHsKICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgICJUaGUgY3VycmVudCBPQ1IgcGFnZSBpcyBub3QgcmVhZHkuIiwKICAgICAgKTsKICAgIH0KCiAgICBjb25zdCBsZXNzb24gPQogICAgICBib29rSWQgPT09ICJjbGFzczYtZW5nbGlzaCIKICAgICAgICA/IGdldExlc3NvbkZvclBhZ2UocGFnZU51bWJlcikKICAgICAgICA6IG51bGw7CgogICAgY29uc3Qgc291cmNlTGluZXMgPQogICAgICBwYWdlRGF0YS5haVJlYWR5TGluZXMubGVuZ3RoID4gMAogICAgICAgID8gcGFnZURhdGEuYWlSZWFkeUxpbmVzCiAgICAgICAgOiBwYWdlRGF0YS5saW5lczsKCiAgICByZXR1cm4gY3JlYXRlUXVpekxhdW5jaENvbnRleHQoewogICAgICBzb3VyY2U6ICJyZWFkZXIiLAogICAgICBib29rOiB7CiAgICAgICAgaWQ6IGN1cnJlbnRCb29rLmlkLAogICAgICAgIHRpdGxlOiBjdXJyZW50Qm9vay50aXRsZSwKICAgICAgICBjbGFzc0xldmVsOgogICAgICAgICAgY3VycmVudEJvb2suY2xhc3NMZXZlbCwKICAgICAgfSwKICAgICAgbGVzc29uOiB7CiAgICAgICAgbnVtYmVyOgogICAgICAgICAgbGVzc29uPy5sZXNzb25ObyA/PyBudWxsLAogICAgICAgIHRpdGxlOiBsZXNzb24/LnRpdGxlID8/IG51bGwsCiAgICAgICAgcmVzb2x1dGlvbjogbGVzc29uCiAgICAgICAgICA/ICJtYXBwZWQiCiAgICAgICAgICA6ICJ1bmF2YWlsYWJsZSIsCiAgICAgIH0sCiAgICAgIHBhZ2U6IHsKICAgICAgICBudW1iZXI6IHBhZ2VOdW1iZXIsCiAgICAgICAgc291cmNlOiBwYWdlRGF0YS5zb3VyY2UsCiAgICAgIH0sCiAgICAgIHNlbGVjdGVkTGluZTogbGluZSwKICAgICAgcGFnZUxpbmVzOiBzb3VyY2VMaW5lcywKICAgIH0pOwogIH0KCgogIGZ1bmN0aW9uIGxhdW5jaFF1aXooCiAgICBsaW5lOiBPQ1JMaW5lIHwgbnVsbCwKICApIHsKICAgIHRyeSB7CiAgICAgIGNvbnN0IGNvbnRleHQgPQogICAgICAgIGJ1aWxkQ3VycmVudFF1aXpDb250ZXh0KGxpbmUpOwoKICAgICAgcGVyc2lzdExlZ2FjeVF1aXpTZWxlY3Rpb24obGluZSk7CiAgICAgIHdyaXRlUXVpekxhdW5jaENvbnRleHQoY29udGV4dCk7CgogICAgICB3aW5kb3cubG9jYXRpb24uYXNzaWduKAogICAgICAgIGJ1aWxkUXVpekhyZWYoY29udGV4dCksCiAgICAgICk7CiAgICB9IGNhdGNoIChsYXVuY2hFcnJvcikgewogICAgICBzZXRFcnJvcigKICAgICAgICBsYXVuY2hFcnJvciBpbnN0YW5jZW9mIEVycm9yCiAgICAgICAgICA/IGxhdW5jaEVycm9yLm1lc3NhZ2UKICAgICAgICAgIDogIlF1aXogY29udGV4dCBjb3VsZCBub3QgYmUgcHJlcGFyZWQuIiwKICAgICAgKTsKICAgIH0KICB9CgoK
'@

$ReaderFunctions = Normalize-Lf (
    ConvertFrom-Base64Utf8 $ReaderFunctionsBase64
)

$SidebarButtonBase64 = @'
ICAgICAgICAgICAgPGJ1dHRvbgogICAgICAgICAgICAgIHR5cGU9ImJ1dHRvbiIKICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBsYXVuY2hRdWl6KG51bGwpfQogICAgICAgICAgICAgIGRpc2FibGVkPXshcGFnZURhdGF9CiAgICAgICAgICAgICAgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBiZy1lbWVyYWxkLTYwMCBweC00IHB5LTMgdGV4dC1jZW50ZXIgdGV4dC1zbSBmb250LWJsYWNrIHRleHQtd2hpdGUgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOm9wYWNpdHktNDAiCiAgICAgICAgICAgID4KICAgICAgICAgICAgICBRdWl6CiAgICAgICAgICAgIDwvYnV0dG9uPg==
'@

$SidebarButton = Normalize-Lf (
    ConvertFrom-Base64Utf8 $SidebarButtonBase64
)

$SelectedButtonBase64 = @'
ICAgICAgICAgICAgPGJ1dHRvbgogICAgICAgICAgICAgIHR5cGU9ImJ1dHRvbiIKICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PgogICAgICAgICAgICAgICAgbGF1bmNoUXVpeihzZWxlY3RlZExpbmUpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIGRpc2FibGVkPXshc2VsZWN0ZWRMaW5lIHx8ICFwYWdlRGF0YX0KICAgICAgICAgICAgICBjbGFzc05hbWU9ImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHJvdW5kZWQtMnhsIGJnLWVtZXJhbGQtNjAwIHB4LTQgcHktMyB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC13aGl0ZSBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS00MCIKICAgICAgICAgICAgPgogICAgICAgICAgICAgIDxCcmFpbiBzaXplPXsxN30gLz4KICAgICAgICAgICAgICBRdWl6IGZyb20gU2VsZWN0ZWQgTGluZQogICAgICAgICAgICA8L2J1dHRvbj4=
'@

$SelectedButton = Normalize-Lf (
    ConvertFrom-Base64Utf8 $SelectedButtonBase64
)

$QuizImportBase64 = @'
aW1wb3J0IHsKICBjcmVhdGVRdWl6TGF1bmNoQ29udGV4dCwKICByZWFkTGVnYWN5UXVpekxhdW5jaENvbnRleHQsCiAgcmVhZFF1aXpMYXVuY2hDb250ZXh0LAogIHdyaXRlUXVpekxhdW5jaENvbnRleHQsCiAgdHlwZSBRdWl6Q29udGV4dExpbmUsCiAgdHlwZSBRdWl6TGF1bmNoQ29udGV4dFYxLAp9IGZyb20gIkAvbGliL3F1aXovcXVpekxhdW5jaENvbnRleHQiOwo=
'@

$QuizImport = Normalize-Lf (
    ConvertFrom-Base64Utf8 $QuizImportBase64
)

$QuizStateAdditionBase64 = @'
ICBjb25zdCBbc2VsZWN0ZWRUZXh0LCBzZXRTZWxlY3RlZFRleHRdID0KICAgIHVzZVN0YXRlKCIiKTsKCiAgY29uc3QgWwogICAgc291cmNlUGFzc2FnZSwKICAgIHNldFNvdXJjZVBhc3NhZ2UsCiAgXSA9IHVzZVN0YXRlKCIiKTsKCiAgY29uc3QgWwogICAgbGF1bmNoQ29udGV4dCwKICAgIHNldExhdW5jaENvbnRleHQsCiAgXSA9CiAgICB1c2VTdGF0ZTxRdWl6TGF1bmNoQ29udGV4dFYxIHwgbnVsbD4oCiAgICAgIG51bGwsCiAgICApOwoKICBjb25zdCBbCiAgICBjb250ZXh0UmVhZHksCiAgICBzZXRDb250ZXh0UmVhZHksCiAgXSA9IHVzZVN0YXRlKGZhbHNlKTs=
'@

$QuizStateAddition = Normalize-Lf (
    ConvertFrom-Base64Utf8 $QuizStateAdditionBase64
)

$QuizInitializationBase64 = @'
ICBmdW5jdGlvbiBhcHBseVF1aXpMYXVuY2hDb250ZXh0KAogICAgY29udGV4dDogUXVpekxhdW5jaENvbnRleHRWMSwKICApIHsKICAgIHNldExhdW5jaENvbnRleHQoY29udGV4dCk7CiAgICBzZXRCb29rSWQoY29udGV4dC5ib29rLmlkKTsKICAgIHNldENsYXNzTGV2ZWwoCiAgICAgIGNvbnRleHQuYm9vay5jbGFzc0xldmVsLAogICAgKTsKICAgIHNldFBhZ2VOdW1iZXIoCiAgICAgIGNvbnRleHQucGFnZS5udW1iZXIsCiAgICApOwogICAgc2V0TGVzc29uTm8oCiAgICAgIGNvbnRleHQubGVzc29uLm51bWJlciA/PyAwLAogICAgKTsKICAgIHNldExlc3NvblRpdGxlKAogICAgICBjb250ZXh0Lmxlc3Nvbi50aXRsZSA/PwogICAgICAgICJMZXNzb24gbWFwcGluZyB1bmF2YWlsYWJsZSIsCiAgICApOwogICAgc2V0U2VsZWN0ZWRUZXh0KAogICAgICBjb250ZXh0LnNlbGVjdGVkTGluZT8udGV4dCA/PyAiIiwKICAgICk7CiAgICBzZXRTb3VyY2VQYXNzYWdlKAogICAgICBjb250ZXh0LnBhc3NhZ2UudGV4dCwKICAgICk7CiAgfQoKICB1c2VFZmZlY3QoKCkgPT4gewogICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlOwoKICAgIGFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVRdWl6Q29udGV4dCgpIHsKICAgICAgc2V0U3R1ZGVudEtleSgKICAgICAgICBnZXRTdG9yZWRTdHVkZW50S2V5KCkgfHwKICAgICAgICAgICJkZW1vLXN0dWRlbnQiLAogICAgICApOwoKICAgICAgc2V0U3R1ZGVudE5hbWUoCiAgICAgICAgZ2V0U3RvcmVkU3R1ZGVudE5hbWUoKSB8fAogICAgICAgICAgIlN0dWRlbnQiLAogICAgICApOwoKICAgICAgY29uc3QgcGFyYW1ldGVycyA9CiAgICAgICAgbmV3IFVSTFNlYXJjaFBhcmFtcygKICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gsCiAgICAgICAgKTsKCiAgICAgIGNvbnN0IGV4cGVjdGVkQ29udGV4dElkID0KICAgICAgICBwYXJhbWV0ZXJzLmdldCgiY29udGV4dElkIik7CgogICAgICBjb25zdCBzdG9yZWRDb250ZXh0ID0KICAgICAgICByZWFkUXVpekxhdW5jaENvbnRleHQoCiAgICAgICAgICBleHBlY3RlZENvbnRleHRJZCwKICAgICAgICApOwoKICAgICAgaWYgKHN0b3JlZENvbnRleHQpIHsKICAgICAgICBpZiAoIWNhbmNlbGxlZCkgewogICAgICAgICAgYXBwbHlRdWl6TGF1bmNoQ29udGV4dCgKICAgICAgICAgICAgc3RvcmVkQ29udGV4dCwKICAgICAgICAgICk7CiAgICAgICAgICBzZXRDb250ZXh0UmVhZHkodHJ1ZSk7CiAgICAgICAgfQoKICAgICAgICByZXR1cm47CiAgICAgIH0KCiAgICAgIGNvbnN0IHF1ZXJ5Qm9va0lkID0KICAgICAgICBwYXJhbWV0ZXJzLmdldCgiYm9va0lkIik7CgogICAgICBjb25zdCBxdWVyeVBhZ2UgPSBOdW1iZXIoCiAgICAgICAgcGFyYW1ldGVycy5nZXQoInBhZ2UiKSwKICAgICAgKTsKCiAgICAgIGlmICgKICAgICAgICBxdWVyeUJvb2tJZCAmJgogICAgICAgIE51bWJlci5pc0ludGVnZXIocXVlcnlQYWdlKSAmJgogICAgICAgIHF1ZXJ5UGFnZSA+IDAKICAgICAgKSB7CiAgICAgICAgdHJ5IHsKICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goCiAgICAgICAgICAgIGAvYXBpL2Jvb2tzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KAogICAgICAgICAgICAgIHF1ZXJ5Qm9va0lkLAogICAgICAgICAgICApfS9wYWdlcy8ke3F1ZXJ5UGFnZX1gLAogICAgICAgICAgICB7CiAgICAgICAgICAgICAgY2FjaGU6ICJuby1zdG9yZSIsCiAgICAgICAgICAgIH0sCiAgICAgICAgICApOwoKICAgICAgICAgIGNvbnN0IGRhdGEgPQogICAgICAgICAgICAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyB7CiAgICAgICAgICAgICAgc3VjY2Vzcz86IGJvb2xlYW47CiAgICAgICAgICAgICAgc291cmNlPzogc3RyaW5nOwogICAgICAgICAgICAgIGxpbmVzPzogUXVpekNvbnRleHRMaW5lW107CiAgICAgICAgICAgICAgYWlSZWFkeUxpbmVzPzogUXVpekNvbnRleHRMaW5lW107CiAgICAgICAgICAgICAgZXJyb3I/OiBzdHJpbmc7CiAgICAgICAgICAgIH07CgogICAgICAgICAgaWYgKAogICAgICAgICAgICAhcmVzcG9uc2Uub2sgfHwKICAgICAgICAgICAgIWRhdGEuc3VjY2VzcwogICAgICAgICAgKSB7CiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgICAgICAgICBkYXRhLmVycm9yID8/CiAgICAgICAgICAgICAgICAiUmVhZGVyIGNvbnRleHQgY291bGQgbm90IGJlIHJlY29uc3RydWN0ZWQuIiwKICAgICAgICAgICAgKTsKICAgICAgICAgIH0KCiAgICAgICAgICBjb25zdCBzb3VyY2VMaW5lcyA9CiAgICAgICAgICAgIGRhdGEuYWlSZWFkeUxpbmVzICYmCiAgICAgICAgICAgIGRhdGEuYWlSZWFkeUxpbmVzLmxlbmd0aCA+IDAKICAgICAgICAgICAgICA/IGRhdGEuYWlSZWFkeUxpbmVzCiAgICAgICAgICAgICAgOiBkYXRhLmxpbmVzID8/IFtdOwoKICAgICAgICAgIGNvbnN0IHJlc29sdmVkQ2xhc3NMZXZlbCA9CiAgICAgICAgICAgIGluZmVyQ2xhc3NMZXZlbCgKICAgICAgICAgICAgICBxdWVyeUJvb2tJZCwKICAgICAgICAgICAgKTsKCiAgICAgICAgICBjb25zdCBtYXRjaGluZ1N0b3JlZEJvb2sgPQogICAgICAgICAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgKICAgICAgICAgICAgICAic2VsZWN0ZWRCb29rSWQiLAogICAgICAgICAgICApID09PSBxdWVyeUJvb2tJZDsKCiAgICAgICAgICBjb25zdCByZWNvbnN0cnVjdGVkQ29udGV4dCA9CiAgICAgICAgICAgIGNyZWF0ZVF1aXpMYXVuY2hDb250ZXh0KHsKICAgICAgICAgICAgICBjb250ZXh0SWQ6CiAgICAgICAgICAgICAgICBleHBlY3RlZENvbnRleHRJZCA/PwogICAgICAgICAgICAgICAgdW5kZWZpbmVkLAogICAgICAgICAgICAgIHNvdXJjZToKICAgICAgICAgICAgICAgICJ1cmwtcmVjb25zdHJ1Y3Rpb24iLAogICAgICAgICAgICAgIGJvb2s6IHsKICAgICAgICAgICAgICAgIGlkOiBxdWVyeUJvb2tJZCwKICAgICAgICAgICAgICAgIHRpdGxlOgogICAgICAgICAgICAgICAgICAobWF0Y2hpbmdTdG9yZWRCb29rCiAgICAgICAgICAgICAgICAgICAgPyBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgKICAgICAgICAgICAgICAgICAgICAgICAgInNlbGVjdGVkQm9va1RpdGxlIiwKICAgICAgICAgICAgICAgICAgICAgICkKICAgICAgICAgICAgICAgICAgICA6IG51bGwpIHx8CiAgICAgICAgICAgICAgICAgIGBFbmdsaXNoIEZvciBUb2RheSDigJQgQ2xhc3MgJHtyZXNvbHZlZENsYXNzTGV2ZWx9YCwKICAgICAgICAgICAgICAgIGNsYXNzTGV2ZWw6CiAgICAgICAgICAgICAgICAgIHJlc29sdmVkQ2xhc3NMZXZlbCwKICAgICAgICAgICAgICB9LAogICAgICAgICAgICAgIGxlc3NvbjogewogICAgICAgICAgICAgICAgbnVtYmVyOiBudWxsLAogICAgICAgICAgICAgICAgdGl0bGU6IG51bGwsCiAgICAgICAgICAgICAgICByZXNvbHV0aW9uOgogICAgICAgICAgICAgICAgICAidW5hdmFpbGFibGUiLAogICAgICAgICAgICAgIH0sCiAgICAgICAgICAgICAgcGFnZTogewogICAgICAgICAgICAgICAgbnVtYmVyOiBxdWVyeVBhZ2UsCiAgICAgICAgICAgICAgICBzb3VyY2U6CiAgICAgICAgICAgICAgICAgIGRhdGEuc291cmNlID8/IG51bGwsCiAgICAgICAgICAgICAgfSwKICAgICAgICAgICAgICBzZWxlY3RlZExpbmU6IG51bGwsCiAgICAgICAgICAgICAgcGFnZUxpbmVzOiBzb3VyY2VMaW5lcywKICAgICAgICAgICAgfSk7CgogICAgICAgICAgd3JpdGVRdWl6TGF1bmNoQ29udGV4dCgKICAgICAgICAgICAgcmVjb25zdHJ1Y3RlZENvbnRleHQsCiAgICAgICAgICApOwoKICAgICAgICAgIGlmICghY2FuY2VsbGVkKSB7CiAgICAgICAgICAgIGFwcGx5UXVpekxhdW5jaENvbnRleHQoCiAgICAgICAgICAgICAgcmVjb25zdHJ1Y3RlZENvbnRleHQsCiAgICAgICAgICAgICk7CiAgICAgICAgICAgIHNldFdhcm5pbmcoCiAgICAgICAgICAgICAgIlRoZSBwYWdlIGNvbnRleHQgd2FzIHJlY29uc3RydWN0ZWQgZnJvbSB0aGUgUmVhZGVyIFVSTC4gU2VsZWN0IGEgbGluZSBpbiB0aGUgUmVhZGVyIGZvciBsaW5lLXNwZWNpZmljIHF1ZXN0aW9ucy4iLAogICAgICAgICAgICApOwogICAgICAgICAgICBzZXRDb250ZXh0UmVhZHkodHJ1ZSk7CiAgICAgICAgICB9CgogICAgICAgICAgcmV0dXJuOwogICAgICAgIH0gY2F0Y2ggKGNvbnRleHRFcnJvcikgewogICAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHsKICAgICAgICAgICAgc2V0V2FybmluZygKICAgICAgICAgICAgICBjb250ZXh0RXJyb3IgaW5zdGFuY2VvZiBFcnJvcgogICAgICAgICAgICAgICAgPyBjb250ZXh0RXJyb3IubWVzc2FnZQogICAgICAgICAgICAgICAgOiAiUmVhZGVyIGNvbnRleHQgcmVjb25zdHJ1Y3Rpb24gZmFpbGVkLiIsCiAgICAgICAgICAgICk7CiAgICAgICAgICB9CiAgICAgICAgfQogICAgICB9CgogICAgICBjb25zdCBsZWdhY3lDb250ZXh0ID0KICAgICAgICByZWFkTGVnYWN5UXVpekxhdW5jaENvbnRleHQoKTsKCiAgICAgIGlmIChsZWdhY3lDb250ZXh0KSB7CiAgICAgICAgd3JpdGVRdWl6TGF1bmNoQ29udGV4dCgKICAgICAgICAgIGxlZ2FjeUNvbnRleHQsCiAgICAgICAgKTsKCiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHsKICAgICAgICAgIGFwcGx5UXVpekxhdW5jaENvbnRleHQoCiAgICAgICAgICAgIGxlZ2FjeUNvbnRleHQsCiAgICAgICAgICApOwogICAgICAgICAgc2V0V2FybmluZygKICAgICAgICAgICAgIkxlZ2FjeSBSZWFkZXIgY29udGV4dCB3YXMgcmVjb3ZlcmVkLiBSZXR1cm4gdG8gdGhlIFJlYWRlciBiZWZvcmUgdGhlIG5leHQgcXVpeiB0byBjcmVhdGUgYSBmdWxseSB2ZXJpZmllZCBjb250ZXh0LiIsCiAgICAgICAgICApOwogICAgICAgICAgc2V0Q29udGV4dFJlYWR5KHRydWUpOwogICAgICAgIH0KCiAgICAgICAgcmV0dXJuOwogICAgICB9CgogICAgICBpZiAoIWNhbmNlbGxlZCkgewogICAgICAgIHNldEVycm9yKAogICAgICAgICAgIk5vIHZlcmlmaWVkIFJlYWRlciBjb250ZXh0IHdhcyBmb3VuZC4gUmV0dXJuIHRvIHRoZSBSZWFkZXIsIG9wZW4gYSBib29rIHBhZ2UsIGFuZCBzZWxlY3QgYSBsaW5lIG9yIHN0YXJ0IGEgcGFnZSBxdWl6LiIsCiAgICAgICAgKTsKICAgICAgICBzZXRDb250ZXh0UmVhZHkoZmFsc2UpOwogICAgICB9CiAgICB9CgogICAgdm9pZCBpbml0aWFsaXplUXVpekNvbnRleHQoKTsKCiAgICByZXR1cm4gKCkgPT4gewogICAgICBjYW5jZWxsZWQgPSB0cnVlOwogICAgfTsKICB9LCBbXSk7
'@

$QuizInitialization = Normalize-Lf (
    ConvertFrom-Base64Utf8 $QuizInitializationBase64
)

$ContextFileBase64 = @'
ZXhwb3J0IGNvbnN0IFFVSVpfTEFVTkNIX0NPTlRFWFRfU1RPUkFHRV9LRVkgPQogICJuY3RiLnF1aXpMYXVuY2hDb250ZXh0LnYxIjsKCmV4cG9ydCB0eXBlIFF1aXpDb250ZXh0U291cmNlID0KICB8ICJyZWFkZXIiCiAgfCAidXJsLXJlY29uc3RydWN0aW9uIgogIHwgImxlZ2FjeSI7CgpleHBvcnQgdHlwZSBMZXNzb25SZXNvbHV0aW9uID0KICB8ICJtYXBwZWQiCiAgfCAidW5hdmFpbGFibGUiOwoKZXhwb3J0IHR5cGUgUXVpekNvbnRleHRMaW5lID0gewogIGlkOiBzdHJpbmc7CiAgbGluZU51bWJlcjogbnVtYmVyOwogIHRleHQ6IHN0cmluZzsKICBjbGVhblRleHQ/OiBzdHJpbmc7Cn07CgpleHBvcnQgdHlwZSBRdWl6TGF1bmNoQ29udGV4dFYxID0gewogIHNjaGVtYVZlcnNpb246IDE7CiAgY29udGV4dElkOiBzdHJpbmc7CiAgY3JlYXRlZEF0OiBzdHJpbmc7CiAgc291cmNlOiBRdWl6Q29udGV4dFNvdXJjZTsKCiAgYm9vazogewogICAgaWQ6IHN0cmluZzsKICAgIHRpdGxlOiBzdHJpbmc7CiAgICBjbGFzc0xldmVsOiBudW1iZXI7CiAgfTsKCiAgbGVzc29uOiB7CiAgICBudW1iZXI6IG51bWJlciB8IG51bGw7CiAgICB0aXRsZTogc3RyaW5nIHwgbnVsbDsKICAgIHJlc29sdXRpb246IExlc3NvblJlc29sdXRpb247CiAgfTsKCiAgcGFnZTogewogICAgbnVtYmVyOiBudW1iZXI7CiAgICBzb3VyY2U6IHN0cmluZyB8IG51bGw7CiAgfTsKCiAgc2VsZWN0ZWRMaW5lOiB7CiAgICBpZDogc3RyaW5nOwogICAgbGluZU51bWJlcjogbnVtYmVyOwogICAgdGV4dDogc3RyaW5nOwogIH0gfCBudWxsOwoKICBwYXNzYWdlOiB7CiAgICBpZDogbnVsbDsKICAgIHRleHQ6IHN0cmluZzsKICAgIHNvdXJjZTogInBhZ2Utb2NyIiB8ICJzZWxlY3RlZC1saW5lIjsKICAgIGxpbmVJZHM6IHN0cmluZ1tdOwogIH07Cn07Cgp0eXBlIENyZWF0ZVF1aXpMYXVuY2hDb250ZXh0SW5wdXQgPSB7CiAgY29udGV4dElkPzogc3RyaW5nOwogIHNvdXJjZT86IFF1aXpDb250ZXh0U291cmNlOwoKICBib29rOiB7CiAgICBpZDogc3RyaW5nOwogICAgdGl0bGU6IHN0cmluZzsKICAgIGNsYXNzTGV2ZWw6IG51bWJlcjsKICB9OwoKICBsZXNzb246IHsKICAgIG51bWJlcjogbnVtYmVyIHwgbnVsbDsKICAgIHRpdGxlOiBzdHJpbmcgfCBudWxsOwogICAgcmVzb2x1dGlvbjogTGVzc29uUmVzb2x1dGlvbjsKICB9OwoKICBwYWdlOiB7CiAgICBudW1iZXI6IG51bWJlcjsKICAgIHNvdXJjZT86IHN0cmluZyB8IG51bGw7CiAgfTsKCiAgc2VsZWN0ZWRMaW5lPzogUXVpekNvbnRleHRMaW5lIHwgbnVsbDsKICBwYWdlTGluZXM6IFF1aXpDb250ZXh0TGluZVtdOwp9OwoKZnVuY3Rpb24gY3JlYXRlQ29udGV4dElkKCkgewogIGlmICgKICAgIHR5cGVvZiBjcnlwdG8gIT09ICJ1bmRlZmluZWQiICYmCiAgICB0eXBlb2YgY3J5cHRvLnJhbmRvbVVVSUQgPT09ICJmdW5jdGlvbiIKICApIHsKICAgIHJldHVybiBjcnlwdG8ucmFuZG9tVVVJRCgpOwogIH0KCiAgcmV0dXJuIFsKICAgICJxdWl6IiwKICAgIERhdGUubm93KCkudG9TdHJpbmcoMzYpLAogICAgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiksCiAgXS5qb2luKCItIik7Cn0KCmZ1bmN0aW9uIGNsZWFuTGluZVRleHQobGluZTogUXVpekNvbnRleHRMaW5lKSB7CiAgcmV0dXJuIFN0cmluZygKICAgIGxpbmUuY2xlYW5UZXh0ID8/IGxpbmUudGV4dCA/PyAiIiwKICApCiAgICAucmVwbGFjZSgvXHMrL2csICIgIikKICAgIC50cmltKCk7Cn0KCmZ1bmN0aW9uIGlzUG9zaXRpdmVJbnRlZ2VyKHZhbHVlOiB1bmtub3duKSB7CiAgcmV0dXJuICgKICAgIHR5cGVvZiB2YWx1ZSA9PT0gIm51bWJlciIgJiYKICAgIE51bWJlci5pc0ludGVnZXIodmFsdWUpICYmCiAgICB2YWx1ZSA+IDAKICApOwp9CgpmdW5jdGlvbiBpc05vbkVtcHR5U3RyaW5nKHZhbHVlOiB1bmtub3duKSB7CiAgcmV0dXJuICgKICAgIHR5cGVvZiB2YWx1ZSA9PT0gInN0cmluZyIgJiYKICAgIHZhbHVlLnRyaW0oKS5sZW5ndGggPiAwCiAgKTsKfQoKZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVF1aXpMYXVuY2hDb250ZXh0KAogIGlucHV0OiBDcmVhdGVRdWl6TGF1bmNoQ29udGV4dElucHV0LAopOiBRdWl6TGF1bmNoQ29udGV4dFYxIHsKICBpZiAoIWlzTm9uRW1wdHlTdHJpbmcoaW5wdXQuYm9vay5pZCkpIHsKICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgIlF1aXogY29udGV4dCByZXF1aXJlcyBhIGJvb2sgaWRlbnRpZmllci4iLAogICAgKTsKICB9CgogIGlmICgKICAgICFOdW1iZXIuaXNJbnRlZ2VyKGlucHV0LmJvb2suY2xhc3NMZXZlbCkgfHwKICAgIGlucHV0LmJvb2suY2xhc3NMZXZlbCA8IDEKICApIHsKICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgIlF1aXogY29udGV4dCByZXF1aXJlcyBhIHZhbGlkIGNsYXNzIGxldmVsLiIsCiAgICApOwogIH0KCiAgaWYgKCFpc1Bvc2l0aXZlSW50ZWdlcihpbnB1dC5wYWdlLm51bWJlcikpIHsKICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgIlF1aXogY29udGV4dCByZXF1aXJlcyBhIHZhbGlkIHBhZ2UgbnVtYmVyLiIsCiAgICApOwogIH0KCiAgY29uc3QgdXNhYmxlTGluZXMgPSBpbnB1dC5wYWdlTGluZXMKICAgIC5tYXAoKGxpbmUpID0+ICh7CiAgICAgIGlkOiBTdHJpbmcobGluZS5pZCA/PyAiIikudHJpbSgpLAogICAgICBsaW5lTnVtYmVyOiBOdW1iZXIobGluZS5saW5lTnVtYmVyKSwKICAgICAgdGV4dDogY2xlYW5MaW5lVGV4dChsaW5lKSwKICAgIH0pKQogICAgLmZpbHRlcigKICAgICAgKGxpbmUpID0+CiAgICAgICAgbGluZS5pZCAmJgogICAgICAgIGlzUG9zaXRpdmVJbnRlZ2VyKGxpbmUubGluZU51bWJlcikgJiYKICAgICAgICBsaW5lLnRleHQsCiAgICApOwoKICBjb25zdCBzZWxlY3RlZExpbmUgPSBpbnB1dC5zZWxlY3RlZExpbmUKICAgID8gewogICAgICAgIGlkOiBTdHJpbmcoCiAgICAgICAgICBpbnB1dC5zZWxlY3RlZExpbmUuaWQgPz8gIiIsCiAgICAgICAgKS50cmltKCksCiAgICAgICAgbGluZU51bWJlcjogTnVtYmVyKAogICAgICAgICAgaW5wdXQuc2VsZWN0ZWRMaW5lLmxpbmVOdW1iZXIsCiAgICAgICAgKSwKICAgICAgICB0ZXh0OiBjbGVhbkxpbmVUZXh0KAogICAgICAgICAgaW5wdXQuc2VsZWN0ZWRMaW5lLAogICAgICAgICksCiAgICAgIH0KICAgIDogbnVsbDsKCiAgaWYgKAogICAgc2VsZWN0ZWRMaW5lICYmCiAgICAoIXNlbGVjdGVkTGluZS5pZCB8fAogICAgICAhaXNQb3NpdGl2ZUludGVnZXIoCiAgICAgICAgc2VsZWN0ZWRMaW5lLmxpbmVOdW1iZXIsCiAgICAgICkgfHwKICAgICAgIXNlbGVjdGVkTGluZS50ZXh0KQogICkgewogICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAiVGhlIHNlbGVjdGVkIE9DUiBsaW5lIGlzIGludmFsaWQuIiwKICAgICk7CiAgfQoKICBjb25zdCBwYWdlUGFzc2FnZSA9IHVzYWJsZUxpbmVzCiAgICAubWFwKChsaW5lKSA9PiBsaW5lLnRleHQpCiAgICAuam9pbigiXG4iKQogICAgLnRyaW0oKTsKCiAgY29uc3QgcGFzc2FnZVRleHQgPQogICAgcGFnZVBhc3NhZ2UgfHwgc2VsZWN0ZWRMaW5lPy50ZXh0IHx8ICIiOwoKICBpZiAoIXBhc3NhZ2VUZXh0KSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICJUaGUgY3VycmVudCBPQ1IgcGFnZSBoYXMgbm8gdXNhYmxlIHRleHQgZm9yIGEgcXVpei4iLAogICAgKTsKICB9CgogIHJldHVybiB7CiAgICBzY2hlbWFWZXJzaW9uOiAxLAogICAgY29udGV4dElkOgogICAgICBpbnB1dC5jb250ZXh0SWQ/LnRyaW0oKSB8fAogICAgICBjcmVhdGVDb250ZXh0SWQoKSwKICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgc291cmNlOiBpbnB1dC5zb3VyY2UgPz8gInJlYWRlciIsCgogICAgYm9vazogewogICAgICBpZDogaW5wdXQuYm9vay5pZC50cmltKCksCiAgICAgIHRpdGxlOgogICAgICAgIGlucHV0LmJvb2sudGl0bGUudHJpbSgpIHx8CiAgICAgICAgaW5wdXQuYm9vay5pZC50cmltKCksCiAgICAgIGNsYXNzTGV2ZWw6IGlucHV0LmJvb2suY2xhc3NMZXZlbCwKICAgIH0sCgogICAgbGVzc29uOiB7CiAgICAgIG51bWJlcjoKICAgICAgICBpbnB1dC5sZXNzb24ubnVtYmVyICE9PSBudWxsICYmCiAgICAgICAgaXNQb3NpdGl2ZUludGVnZXIoCiAgICAgICAgICBpbnB1dC5sZXNzb24ubnVtYmVyLAogICAgICAgICkKICAgICAgICAgID8gaW5wdXQubGVzc29uLm51bWJlcgogICAgICAgICAgOiBudWxsLAogICAgICB0aXRsZToKICAgICAgICBpbnB1dC5sZXNzb24udGl0bGU/LnRyaW0oKSB8fAogICAgICAgIG51bGwsCiAgICAgIHJlc29sdXRpb246CiAgICAgICAgaW5wdXQubGVzc29uLnJlc29sdXRpb24sCiAgICB9LAoKICAgIHBhZ2U6IHsKICAgICAgbnVtYmVyOiBpbnB1dC5wYWdlLm51bWJlciwKICAgICAgc291cmNlOgogICAgICAgIGlucHV0LnBhZ2Uuc291cmNlPy50cmltKCkgfHwKICAgICAgICBudWxsLAogICAgfSwKCiAgICBzZWxlY3RlZExpbmUsCgogICAgcGFzc2FnZTogewogICAgICBpZDogbnVsbCwKICAgICAgdGV4dDogcGFzc2FnZVRleHQsCiAgICAgIHNvdXJjZTogcGFnZVBhc3NhZ2UKICAgICAgICA/ICJwYWdlLW9jciIKICAgICAgICA6ICJzZWxlY3RlZC1saW5lIiwKICAgICAgbGluZUlkczogdXNhYmxlTGluZXMubWFwKAogICAgICAgIChsaW5lKSA9PiBsaW5lLmlkLAogICAgICApLAogICAgfSwKICB9Owp9CgpleHBvcnQgZnVuY3Rpb24gaXNRdWl6TGF1bmNoQ29udGV4dFYxKAogIHZhbHVlOiB1bmtub3duLAopOiB2YWx1ZSBpcyBRdWl6TGF1bmNoQ29udGV4dFYxIHsKICBpZiAoCiAgICAhdmFsdWUgfHwKICAgIHR5cGVvZiB2YWx1ZSAhPT0gIm9iamVjdCIKICApIHsKICAgIHJldHVybiBmYWxzZTsKICB9CgogIGNvbnN0IGNvbnRleHQgPQogICAgdmFsdWUgYXMgUGFydGlhbDxRdWl6TGF1bmNoQ29udGV4dFYxPjsKCiAgcmV0dXJuIEJvb2xlYW4oCiAgICBjb250ZXh0LnNjaGVtYVZlcnNpb24gPT09IDEgJiYKICAgICAgaXNOb25FbXB0eVN0cmluZyhjb250ZXh0LmNvbnRleHRJZCkgJiYKICAgICAgaXNOb25FbXB0eVN0cmluZygKICAgICAgICBjb250ZXh0LmNyZWF0ZWRBdCwKICAgICAgKSAmJgogICAgICBjb250ZXh0LmJvb2sgJiYKICAgICAgaXNOb25FbXB0eVN0cmluZygKICAgICAgICBjb250ZXh0LmJvb2suaWQsCiAgICAgICkgJiYKICAgICAgdHlwZW9mIGNvbnRleHQuYm9vay5jbGFzc0xldmVsID09PQogICAgICAgICJudW1iZXIiICYmCiAgICAgIE51bWJlci5pc0ludGVnZXIoCiAgICAgICAgY29udGV4dC5ib29rLmNsYXNzTGV2ZWwsCiAgICAgICkgJiYKICAgICAgY29udGV4dC5wYWdlICYmCiAgICAgIGlzUG9zaXRpdmVJbnRlZ2VyKAogICAgICAgIGNvbnRleHQucGFnZS5udW1iZXIsCiAgICAgICkgJiYKICAgICAgY29udGV4dC5sZXNzb24gJiYKICAgICAgKGNvbnRleHQubGVzc29uLnJlc29sdXRpb24gPT09CiAgICAgICAgIm1hcHBlZCIgfHwKICAgICAgICBjb250ZXh0Lmxlc3Nvbi5yZXNvbHV0aW9uID09PQogICAgICAgICAgInVuYXZhaWxhYmxlIikgJiYKICAgICAgY29udGV4dC5wYXNzYWdlICYmCiAgICAgIGlzTm9uRW1wdHlTdHJpbmcoCiAgICAgICAgY29udGV4dC5wYXNzYWdlLnRleHQsCiAgICAgICkgJiYKICAgICAgQXJyYXkuaXNBcnJheSgKICAgICAgICBjb250ZXh0LnBhc3NhZ2UubGluZUlkcywKICAgICAgKSwKICApOwp9CgpleHBvcnQgZnVuY3Rpb24gd3JpdGVRdWl6TGF1bmNoQ29udGV4dCgKICBjb250ZXh0OiBRdWl6TGF1bmNoQ29udGV4dFYxLAopIHsKICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gInVuZGVmaW5lZCIpIHsKICAgIHJldHVybjsKICB9CgogIHNlc3Npb25TdG9yYWdlLnNldEl0ZW0oCiAgICBRVUlaX0xBVU5DSF9DT05URVhUX1NUT1JBR0VfS0VZLAogICAgSlNPTi5zdHJpbmdpZnkoY29udGV4dCksCiAgKTsKfQoKZXhwb3J0IGZ1bmN0aW9uIHJlYWRRdWl6TGF1bmNoQ29udGV4dCgKICBleHBlY3RlZENvbnRleHRJZD86IHN0cmluZyB8IG51bGwsCik6IFF1aXpMYXVuY2hDb250ZXh0VjEgfCBudWxsIHsKICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gInVuZGVmaW5lZCIpIHsKICAgIHJldHVybiBudWxsOwogIH0KCiAgY29uc3QgcmF3ID0gc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbSgKICAgIFFVSVpfTEFVTkNIX0NPTlRFWFRfU1RPUkFHRV9LRVksCiAgKTsKCiAgaWYgKCFyYXcpIHsKICAgIHJldHVybiBudWxsOwogIH0KCiAgdHJ5IHsKICAgIGNvbnN0IHBhcnNlZDogdW5rbm93biA9IEpTT04ucGFyc2UocmF3KTsKCiAgICBpZiAoIWlzUXVpekxhdW5jaENvbnRleHRWMShwYXJzZWQpKSB7CiAgICAgIHJldHVybiBudWxsOwogICAgfQoKICAgIGlmICgKICAgICAgZXhwZWN0ZWRDb250ZXh0SWQgJiYKICAgICAgcGFyc2VkLmNvbnRleHRJZCAhPT0gZXhwZWN0ZWRDb250ZXh0SWQKICAgICkgewogICAgICByZXR1cm4gbnVsbDsKICAgIH0KCiAgICByZXR1cm4gcGFyc2VkOwogIH0gY2F0Y2ggewogICAgcmV0dXJuIG51bGw7CiAgfQp9CgpmdW5jdGlvbiBpbmZlckNsYXNzTGV2ZWwoYm9va0lkOiBzdHJpbmcpIHsKICBjb25zdCBtYXRjaCA9IGJvb2tJZC5tYXRjaCgKICAgIC9jbGFzcyhcZCspL2ksCiAgKTsKCiAgY29uc3QgdmFsdWUgPSBtYXRjaAogICAgPyBOdW1iZXIobWF0Y2hbMV0pCiAgICA6IDA7CgogIHJldHVybiBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSAmJgogICAgdmFsdWUgPiAwCiAgICA/IHZhbHVlCiAgICA6IDA7Cn0KCmV4cG9ydCBmdW5jdGlvbiByZWFkTGVnYWN5UXVpekxhdW5jaENvbnRleHQoKToKICB8IFF1aXpMYXVuY2hDb250ZXh0VjEKICB8IG51bGwgewogIGlmICh0eXBlb2Ygd2luZG93ID09PSAidW5kZWZpbmVkIikgewogICAgcmV0dXJuIG51bGw7CiAgfQoKICBjb25zdCBib29rSWQgPQogICAgbG9jYWxTdG9yYWdlCiAgICAgIC5nZXRJdGVtKCJzZWxlY3RlZEJvb2tJZCIpCiAgICAgID8udHJpbSgpID8/ICIiOwoKICBjb25zdCBwYWdlTnVtYmVyID0gTnVtYmVyKAogICAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oCiAgICAgICJzZWxlY3RlZEJvb2tQZGZQYWdlIiwKICAgICksCiAgKTsKCiAgY29uc3Qgc2VsZWN0ZWRUZXh0ID0KICAgIGxvY2FsU3RvcmFnZQogICAgICAuZ2V0SXRlbSgic2VsZWN0ZWRMaW5lIikKICAgICAgPy50cmltKCkgPz8gIiI7CgogIGlmICgKICAgICFib29rSWQgfHwKICAgICFpc1Bvc2l0aXZlSW50ZWdlcihwYWdlTnVtYmVyKSB8fAogICAgIXNlbGVjdGVkVGV4dAogICkgewogICAgcmV0dXJuIG51bGw7CiAgfQoKICBjb25zdCBjbGFzc0xldmVsID0KICAgIE51bWJlcigKICAgICAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oCiAgICAgICAgInNlbGVjdGVkQ2xhc3MiLAogICAgICApLAogICAgKSB8fAogICAgaW5mZXJDbGFzc0xldmVsKGJvb2tJZCk7CgogIGlmICgKICAgICFOdW1iZXIuaXNJbnRlZ2VyKGNsYXNzTGV2ZWwpIHx8CiAgICBjbGFzc0xldmVsIDwgMQogICkgewogICAgcmV0dXJuIG51bGw7CiAgfQoKICBjb25zdCBsZXNzb25WYWx1ZSA9IE51bWJlcigKICAgIGxvY2FsU3RvcmFnZS5nZXRJdGVtKAogICAgICAic2VsZWN0ZWRMZXNzb25ObyIsCiAgICApLAogICk7CgogIGNvbnN0IGxlc3Nvbk51bWJlciA9CiAgICBpc1Bvc2l0aXZlSW50ZWdlcihsZXNzb25WYWx1ZSkKICAgICAgPyBsZXNzb25WYWx1ZQogICAgICA6IG51bGw7CgogIHJldHVybiBjcmVhdGVRdWl6TGF1bmNoQ29udGV4dCh7CiAgICBzb3VyY2U6ICJsZWdhY3kiLAogICAgYm9vazogewogICAgICBpZDogYm9va0lkLAogICAgICB0aXRsZToKICAgICAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgKICAgICAgICAgICJzZWxlY3RlZEJvb2tUaXRsZSIsCiAgICAgICAgKSB8fAogICAgICAgIGBFbmdsaXNoIEZvciBUb2RheSDigJQgQ2xhc3MgJHtjbGFzc0xldmVsfWAsCiAgICAgIGNsYXNzTGV2ZWwsCiAgICB9LAogICAgbGVzc29uOiB7CiAgICAgIG51bWJlcjogbGVzc29uTnVtYmVyLAogICAgICB0aXRsZToKICAgICAgICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgKICAgICAgICAgICJzZWxlY3RlZExlc3NvblRpdGxlIiwKICAgICAgICApIHx8IG51bGwsCiAgICAgIHJlc29sdXRpb246IGxlc3Nvbk51bWJlcgogICAgICAgID8gIm1hcHBlZCIKICAgICAgICA6ICJ1bmF2YWlsYWJsZSIsCiAgICB9LAogICAgcGFnZTogewogICAgICBudW1iZXI6IHBhZ2VOdW1iZXIsCiAgICAgIHNvdXJjZTogImxlZ2FjeS1sb2NhbC1zdG9yYWdlIiwKICAgIH0sCiAgICBzZWxlY3RlZExpbmU6IHsKICAgICAgaWQ6IGBsZWdhY3ktJHtib29rSWR9LSR7cGFnZU51bWJlcn1gLAogICAgICBsaW5lTnVtYmVyOiAxLAogICAgICB0ZXh0OiBzZWxlY3RlZFRleHQsCiAgICB9LAogICAgcGFnZUxpbmVzOiBbCiAgICAgIHsKICAgICAgICBpZDogYGxlZ2FjeS0ke2Jvb2tJZH0tJHtwYWdlTnVtYmVyfWAsCiAgICAgICAgbGluZU51bWJlcjogMSwKICAgICAgICB0ZXh0OiBzZWxlY3RlZFRleHQsCiAgICAgIH0sCiAgICBdLAogIH0pOwp9CgpleHBvcnQgZnVuY3Rpb24gYnVpbGRRdWl6SHJlZigKICBjb250ZXh0OiBRdWl6TGF1bmNoQ29udGV4dFYxLAopIHsKICBjb25zdCBwYXJhbWV0ZXJzID0KICAgIG5ldyBVUkxTZWFyY2hQYXJhbXMoewogICAgICBjb250ZXh0SWQ6IGNvbnRleHQuY29udGV4dElkLAogICAgICBib29rSWQ6IGNvbnRleHQuYm9vay5pZCwKICAgICAgcGFnZTogU3RyaW5nKAogICAgICAgIGNvbnRleHQucGFnZS5udW1iZXIsCiAgICAgICksCiAgICB9KTsKCiAgaWYgKGNvbnRleHQubGVzc29uLm51bWJlcikgewogICAgcGFyYW1ldGVycy5zZXQoCiAgICAgICJsZXNzb24iLAogICAgICBTdHJpbmcoY29udGV4dC5sZXNzb24ubnVtYmVyKSwKICAgICk7CiAgfQoKICByZXR1cm4gYC9xdWl6PyR7cGFyYW1ldGVycy50b1N0cmluZygpfWA7Cn0K
'@

$ContextFileBytes = [System.Convert]::FromBase64String(
    ($ContextFileBase64 -replace '\s', '')
)

$ReaderImportMarker = @'
import {
  class6Lessons,
  getLessonForPage,
} from "@/lib/book/class6Lessons";
'@

$Reader = Replace-ExactOnce `
    -Content $Reader `
    -OldValue $ReaderImportMarker `
    -NewValue ($ReaderImportMarker + "`n`n" + $ReaderImport.TrimEnd()) `
    -Label "Reader quiz-context import"

$Reader = Replace-RegexOnce `
    -Content $Reader `
    -Pattern '  function selectBookLine\(\s*line: OCRLine,\s*\) \{[\s\S]*?^  async function askTeacher\(' `
    -Replacement ($ReaderFunctions + "  async function askTeacher(") `
    -Label "Reader selection and launch functions"

$SidebarOld = @'
            <Link
              href="/quiz"
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white"
            >
              Quiz
            </Link>
'@

$Reader = Replace-ExactOnce `
    -Content $Reader `
    -OldValue $SidebarOld `
    -NewValue $SidebarButton `
    -Label "Reader page-level Quiz button"

$Reader = Replace-RegexOnce `
    -Content $Reader `
    -Pattern '            <Link\s+href="/quiz"\s+onClick=\{\(\) => \{[\s\S]*?Quiz from Selected Line\s+</Link>' `
    -Replacement $SelectedButton `
    -Label "Reader selected-line Quiz button"

$Quiz = Replace-ExactOnce `
    -Content $Quiz `
    -OldValue 'type Difficulty =' `
    -NewValue ($QuizImport.TrimEnd() + "`n`n" + 'type Difficulty =') `
    -Label "Quiz context import"

$OldSelectedState = @'
  const [selectedText, setSelectedText] =
    useState("");
'@

$Quiz = Replace-ExactOnce `
    -Content $Quiz `
    -OldValue $OldSelectedState `
    -NewValue $QuizStateAddition `
    -Label "Quiz launch-context state"

$Quiz = Replace-RegexOnce `
    -Content $Quiz `
    -Pattern '  useEffect\(\(\) => \{\s*const storedBookId =[\s\S]*?^  \}, \[\]\);' `
    -Replacement $QuizInitialization `
    -Label "Quiz initialization"

$OldGenerateContext = @'
            lessonNo,
            lessonTitle,
            selectedText,
            difficulty,
'@

$NewGenerateContext = @'
            lessonNo:
              launchContext?.lesson
                .number ?? null,
            lessonTitle:
              launchContext?.lesson
                .title ?? lessonTitle,
            selectedText,
            passageText:
              sourcePassage,
            contextId:
              launchContext?.contextId ??
              null,
            selectedLineId:
              launchContext?.selectedLine
                ?.id ?? null,
            selectedLineNumber:
              launchContext?.selectedLine
                ?.lineNumber ?? null,
            lessonResolution:
              launchContext?.lesson
                .resolution ??
              "unavailable",
            passageSource:
              launchContext?.passage
                .source ?? null,
            sourceLineIds:
              launchContext?.passage
                .lineIds ?? [],
            difficulty,
'@

$Quiz = Replace-ExactOnce `
    -Content $Quiz `
    -OldValue $OldGenerateContext `
    -NewValue $NewGenerateContext `
    -Label "Quiz generation context payload"

$Quiz = Replace-ExactOnce `
    -Content $Quiz `
    -OldValue '{selectedText ||' `
    -NewValue '{sourcePassage || selectedText ||' `
    -Label "Quiz source-passage display"

$OldDisabled = @'
                disabled={
                  loading ||
                  (!selectedText &&
                    pageNumber < 1)
                }
'@

$NewDisabled = @'
                disabled={
                  loading ||
                  !contextReady ||
                  (!sourcePassage &&
                    !selectedText)
                }
'@

$Quiz = Replace-ExactOnce `
    -Content $Quiz `
    -OldValue $OldDisabled `
    -NewValue $NewDisabled `
    -Label "Quiz generation guard"

$OldSubmitTail = @'
          quizMode: "model",
'@

$NewSubmitTail = @'
          quizMode: "model",
          contextId:
            launchContext?.contextId ??
            null,
          sourceLessonNo:
            launchContext?.lesson.number ??
            null,
          lessonResolution:
            launchContext?.lesson
              .resolution ??
            "unavailable",
          selectedLineId:
            launchContext?.selectedLine
              ?.id ?? null,
          selectedLineNumber:
            launchContext?.selectedLine
              ?.lineNumber ?? null,
          sourcePassage,
          sourceLineIds:
            launchContext?.passage
              .lineIds ?? [],
'@

$Quiz = Replace-ExactOnce `
    -Content $Quiz `
    -OldValue $OldSubmitTail `
    -NewValue $NewSubmitTail `
    -Label "Quiz submission context payload"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $ReaderPath,
    $Reader,
    $Utf8NoBom
)

[System.IO.File]::WriteAllText(
    $QuizPath,
    $Quiz,
    $Utf8NoBom
)

[System.IO.File]::WriteAllBytes(
    $ContextPath,
    $ContextFileBytes
)

$ReportPath = Join-Path $ProjectRoot "phase1-quiz-context-v2-report-$Timestamp.txt"

$Report = @"
NCTB Study Companion — Phase 1 Reader-to-Quiz Context
Generated: $(Get-Date -Format o)

Backup:
$BackupRoot

Created:
$ContextPath

Modified:
$ReaderPath
$QuizPath

Implemented:
- Atomic, versioned Reader-to-Quiz context in sessionStorage
- Context ID, book, class, page, source line and page OCR passage
- Class 6 mapped lesson metadata
- Explicit unavailable lesson metadata for Class 7 and Class 8
- URL identifiers for reproducible navigation
- URL-based page-context reconstruction
- Legacy localStorage fallback
- Additive generation and submission metadata
- Guard against quiz generation without verified context

Not changed:
- Existing book APIs
- Quiz generation endpoint behavior
- Quiz submission database schema
- Existing scoring logic
- Existing Vercel routes
"@

[System.IO.File]::WriteAllText(
    $ReportPath,
    $Report,
    $Utf8NoBom
)

Write-Host ""
Write-Host "Phase 1 context patch v2 installed." -ForegroundColor Green
Write-Host ""
Write-Host "Backup:" -ForegroundColor Cyan
Write-Host $BackupRoot
Write-Host ""
Write-Host "Audit report:" -ForegroundColor Cyan
Write-Host $ReportPath
Write-Host ""
Write-Host "Run these validation commands next:" -ForegroundColor Yellow
Write-Host "  npx tsc --noEmit"
Write-Host "  npm run build"
Write-Host "  git diff --check"
