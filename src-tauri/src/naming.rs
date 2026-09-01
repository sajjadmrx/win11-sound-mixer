//! Friendly naming and categorization for audio applications.

/// Map of well-known executables to friendly display names.
pub fn display_name(exe: &str) -> String {
    match exe {
        "system" => "System Sounds".into(),
        "spotify" => "Spotify".into(),
        "chrome" => "Google Chrome".into(),
        "msedge" => "Microsoft Edge".into(),
        "firefox" => "Firefox".into(),
        "brave" => "Brave".into(),
        "opera" => "Opera".into(),
        "discord" => "Discord".into(),
        "zoom" => "Zoom".into(),
        "teams" => "Microsoft Teams".into(),
        "slack" => "Slack".into(),
        "obs64" | "obs32" => "OBS Studio".into(),
        "vlc" => "VLC Media Player".into(),
        "wmplayer" => "Media Player".into(),
        "code" => "VS Code".into(),
        "steam" => "Steam".into(),
        "epicgameslauncher" => "Epic Games".into(),
        "valorant" => "VALORANT".into(),
        "javaw" => "Minecraft".into(),
        "cs2" => "Counter-Strike 2".into(),
        "deezer" => "Deezer".into(),
        "tidal" => "TIDAL".into(),
        "soundcloud" => "SoundCloud".into(),
        "spotifynew" => "Spotify".into(),
        "yt-dlp" => "YouTube".into(),
        "potplayer" | "potplayermini64" => "PotPlayer".into(),
        "foobar2000" => "foobar2000".into(),
        "aimp" => "AIMP".into(),
        "signal" => "Signal".into(),
        "telegram" => "Telegram".into(),
        "whatsapp" => "WhatsApp".into(),
        "guilded" => "Guilded".into(),
        "mumble" => "Mumble".into(),
        "voiceserver" | "ts3client_win64" => "TeamSpeak".into(),
        other => {
            // Prettify the raw exe name: "some-app" -> "Some App"
            let pretty = other
                .split(['-', '_'])
                .filter(|p| !p.is_empty())
                .map(|p| {
                    let mut c = p.chars();
                    match c.next() {
                        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            if pretty.is_empty() { other.to_string() } else { pretty }
        }
    }
}

/// Human friendly category shown under each application row.
pub fn category(exe: &str) -> String {
    match exe {
        "system" => "System".into(),
        "spotify" | "deezer" | "tidal" | "soundcloud" | "wmplayer" | "vlc" | "foobar2000"
        | "aimp" => "Music & Media".into(),
        "chrome" | "msedge" | "firefox" | "brave" | "opera" => "Web Browser".into(),
        "discord" | "teams" | "signal" | "telegram" | "whatsapp" | "guilded" | "mumble"
        | "ts3client_win64" => "Voice Chat".into(),
        "zoom" => "Meetings".into(),
        "slack" => "Messaging".into(),
        "valorant" | "cs2" | "javaw" | "steam" | "epicgameslauncher" => "Game".into(),
        "obs64" | "obs32" => "Streaming".into(),
        _ => "Application".into(),
    }
}

#[allow(dead_code)]
pub fn is_communication_app(exe: &str) -> bool {
    matches!(
        exe,
        "discord" | "teams" | "zoom" | "slack" | "signal" | "telegram" | "guilded" | "mumble"
    )
}
