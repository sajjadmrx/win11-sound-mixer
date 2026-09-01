//! Extracts application icons from executables (GDI) and caches them as PNGs.

use base64::Engine;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use windows::Win32::Graphics::Gdi::{
    GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
    DIB_RGB_COLORS,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    DestroyIcon, GetIconInfo, PrivateExtractIconsW, HICON, ICONINFO,
};

/// In-process memo of exe path lookups.
static EXE_PATH_CACHE: Mutex<Option<HashMap<u32, String>>> = Mutex::new(None);

pub fn exe_path_for_pid(pid: u32) -> Option<String> {
    if pid == 0 {
        return None;
    }
    if let Ok(guard) = EXE_PATH_CACHE.lock() {
        if let Some(map) = guard.as_ref() {
            if let Some(p) = map.get(&pid) {
                return Some(p.clone());
            }
        }
    }
    unsafe {
        // Try QueryFullProcessImageNameW first
        let handle_res = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            .or_else(|_| OpenProcess(windows::Win32::System::Threading::PROCESS_QUERY_INFORMATION | windows::Win32::System::Threading::PROCESS_VM_READ, false, pid));

        if let Ok(handle) = handle_res {
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                windows::core::PWSTR(buf.as_mut_ptr()),
                &mut len,
            )
            .is_ok();
            let _ = windows::Win32::Foundation::CloseHandle(handle);
            if ok && len > 0 {
                let path = String::from_utf16_lossy(&buf[..len as usize]);
                if let Ok(mut guard) = EXE_PATH_CACHE.lock() {
                    guard.get_or_insert_with(HashMap::new).insert(pid, path.clone());
                }
                return Some(path);
            }
        }
        None
    }
}

#[allow(dead_code)]
fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Extracts the icon for the given executable as PNG bytes.
pub fn extract_icon_png(exe_path: &str, size: i32) -> Option<Vec<u8>> {
    unsafe {
        let mut buf = [0u16; 260];
        let chars: Vec<u16> = exe_path.encode_utf16().collect();
        if chars.len() >= 260 {
            return None;
        }
        buf[..chars.len()].copy_from_slice(&chars);
        let mut hicons = [HICON::default(); 1];
        let count = PrivateExtractIconsW(
            &buf,
            0,
            size,
            size,
            Some(&mut hicons),
            None,
            1,
        );
        if count == 0 || hicons[0].is_invalid() {
            return None;
        }
        let png = hicon_to_png(hicons[0], size);
        let _ = DestroyIcon(hicons[0]);
        png
    }
}
unsafe fn hicon_to_png(hicon: HICON, size: i32) -> Option<Vec<u8>> {
    let _ = size;
    let mut info = ICONINFO::default();
    GetIconInfo(hicon, &mut info).ok()?;

    // Read color bitmap dimensions
    let mut bm = BITMAP::default();
    let ok = GetObjectW(
        windows::Win32::Graphics::Gdi::HGDIOBJ(info.hbmColor.0),
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bm as *mut BITMAP as *mut _),
    );
    if ok == 0 || bm.bmWidth <= 0 {
        let _ = windows::Win32::Graphics::Gdi::DeleteObject(
            windows::Win32::Graphics::Gdi::HGDIOBJ(info.hbmColor.0),
        );
        let _ = windows::Win32::Graphics::Gdi::DeleteObject(
            windows::Win32::Graphics::Gdi::HGDIOBJ(info.hbmMask.0),
        );
        return None;
    }
    let w = bm.bmWidth;
    let h = bm.bmHeight.abs();

    let mut bmi = BITMAPINFO::default();
    bmi.bmiHeader = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: w,
        biHeight: -h, // top-down
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB.0,
        ..Default::default()
    };

    let mut pixels = vec![0u8; (w * h * 4) as usize];
    let hdc = GetDC(None);
    let lines = GetDIBits(
        hdc,
        info.hbmColor,
        0,
        h as u32,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bmi,
        DIB_RGB_COLORS,
    );
    ReleaseDC(None, hdc);

    let has_alpha = pixels.chunks_exact(4).any(|px| px[3] != 0);

    if lines == 0 {
        let _ = windows::Win32::Graphics::Gdi::DeleteObject(
            windows::Win32::Graphics::Gdi::HGDIOBJ(info.hbmColor.0),
        );
        let _ = windows::Win32::Graphics::Gdi::DeleteObject(
            windows::Win32::Graphics::Gdi::HGDIOBJ(info.hbmMask.0),
        );
        return None;
    }
    // If the color bitmap carries no alpha channel, derive transparency
    // from the 1bpp mask.
    if !has_alpha {
        fill_alpha_from_mask(info.hbmMask, w, h, &mut pixels);
    }

    let _ = windows::Win32::Graphics::Gdi::DeleteObject(
        windows::Win32::Graphics::Gdi::HGDIOBJ(info.hbmColor.0),
    );
    let _ = windows::Win32::Graphics::Gdi::DeleteObject(
        windows::Win32::Graphics::Gdi::HGDIOBJ(info.hbmMask.0),
    );

    // BGRA -> RGBA
    for px in pixels.chunks_exact_mut(4) {
        px.swap(0, 2);
    }

    let img: image::RgbaImage = image::ImageBuffer::from_raw(w as u32, h as u32, pixels)?;
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .ok()?;
    Some(out.into_inner())
}

unsafe fn fill_alpha_from_mask(
    hbm_mask: windows::Win32::Graphics::Gdi::HBITMAP,
    w: i32,
    h: i32,
    pixels: &mut [u8],
) {
    let mut mask_bmi = BITMAPINFO::default();
    mask_bmi.bmiHeader = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: w,
        biHeight: -h,
        biPlanes: 1,
        biBitCount: 1,
        biCompression: BI_RGB.0,
        ..Default::default()
    };
    let row_bytes = ((w + 31) / 32) * 4;
    let mut mask = vec![0u8; (row_bytes * h) as usize];
    let hdc = GetDC(None);
    let got = GetDIBits(
        hdc,
        hbm_mask,
        0,
        h as u32,
        Some(mask.as_mut_ptr() as *mut _),
        &mut mask_bmi,
        DIB_RGB_COLORS,
    );
    ReleaseDC(None, hdc);
    if got != 0 {
        for y in 0..h as usize {
            for x in 0..w as usize {
                let bit = (mask[y * row_bytes as usize + x / 8] >> (7 - (x % 8))) & 1;
                let alpha = if bit == 0 { 255u8 } else { 0u8 };
                pixels[(y * w as usize + x) * 4 + 3] = alpha;
            }
        }
    } else {
        for px in pixels.chunks_exact_mut(4) {
            px[3] = 255;
        }
    }
}

/// Disk cache directory for extracted icons.
pub struct IconCache {
    dir: PathBuf,
}

impl IconCache {
    pub fn new(dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&dir);
        Self { dir }
    }

    pub fn get_or_extract(&self, cache_key: &str, exe_path: &str) -> Option<String> {
        let file = self.dir.join(format!("{}.png", cache_key));
        if file.exists() {
            if let Ok(bytes) = std::fs::read(&file) {
                return Some(to_data_url(&bytes));
            }
        }
        let png = extract_icon_png(exe_path, 48)?;
        let _ = std::fs::write(&file, &png);
        Some(to_data_url(&png))
    }
}

fn to_data_url(png: &[u8]) -> String {
    format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    )
}

