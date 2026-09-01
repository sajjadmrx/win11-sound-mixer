//! Undocumented `IPolicyConfig` COM interface — the same mechanism used by
//! SoundSwitch and similar utilities to programmatically change the default
//! audio endpoint on Windows.
//!
//! CLSID PolicyConfigClient: {870af99c-171d-4f9e-af0d-e63df40c2bc9}
//! IID  IPolicyConfig:       {f8679f50-850a-41cf-9c72-430f290290c8}

use std::ffi::c_void;
use windows::{
    core::{imp::CanInto, Interface, Param, PCWSTR, GUID, HRESULT},
    Win32::Media::Audio::ERole,
    Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED},
};

pub const CLSID_POLICY_CONFIG_CLIENT: GUID =
    GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

#[repr(transparent)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IPolicyConfig(windows::core::IUnknown);

impl CanInto<windows::core::IUnknown> for IPolicyConfig {}

unsafe impl Interface for IPolicyConfig {
    type Vtable = IPolicyConfig_Vtbl;
    const IID: GUID = GUID::from_u128(0xf8679f50_850a_41cf_9c72_430f290290c8);
}

#[repr(C)]
#[doc(hidden)]
#[allow(non_snake_case)]
pub struct IPolicyConfig_Vtbl {
    pub base__: ::windows::core::IUnknown_Vtbl,
    pub get_mix_format: usize,
    pub get_device_format: usize,
    pub reset_device_format: usize,
    pub set_device_format: usize,
    pub get_processing_period: usize,
    pub set_processing_period: usize,
    pub get_share_mode: usize,
    pub set_share_mode: usize,
    pub get_property_value: usize,
    pub set_property_value: usize,
    pub set_default_endpoint: unsafe extern "system" fn(this: *mut c_void, PCWSTR, ERole) -> HRESULT,
    pub set_endpoint_visibility: usize,
}

impl IPolicyConfig {
    pub unsafe fn set_default_endpoint(
        &self,
        device_name: impl Param<PCWSTR>,
        role: ERole,
    ) -> windows::core::Result<()> {
        let vt = Interface::vtable(self);
        (vt.set_default_endpoint)(
            Interface::as_raw(self),
            device_name.param().abi(),
            role,
        )
        .ok()
    }
}

/// Sets the given device as the default render endpoint for all roles
/// (console, multimedia, communications).
pub fn set_default_endpoint(device_id: &str) -> Result<(), String> {
    unsafe {
        // Make sure COM is initialized on this thread (no-op if already done).
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let policy_config: IPolicyConfig = match CoCreateInstance(&CLSID_POLICY_CONFIG_CLIENT, None, CLSCTX_ALL) {
            Ok(p) => p,
            Err(e) => {
                return Err(format!("PolicyConfigClient creation failed: {e}"));
            }
        };

        let mut wide: Vec<u16> = device_id.encode_utf16().collect();
        wide.push(0);
        let pcwstr = PCWSTR(wide.as_ptr());

        // eConsole = 0, eMultimedia = 1, eCommunications = 2
        let mut ok = false;
        for role in [
            windows::Win32::Media::Audio::eConsole,
            windows::Win32::Media::Audio::eMultimedia,
            windows::Win32::Media::Audio::eCommunications,
        ] {
            let res = policy_config.set_default_endpoint(pcwstr, role);
            if res.is_ok() {
                ok = true;
            }
        }

        if ok {
            Ok(())
        } else {
            Err("SetDefaultEndpoint failed".into())
        }
    }
}

/// Attempt to route an application to a device by making the target device
/// the default for a brief moment while the app opens its audio stream.
/// Windows binds streams to a device at creation time; after the window
/// elapses we restore the previous default.
#[allow(dead_code)]
pub struct DefaultSwap {
    pub previous_default: String,
}

impl Drop for DefaultSwap {
    fn drop(&mut self) {
        // Best effort restore; the engine always restores explicitly as well.
        let _ = set_default_endpoint(&self.previous_default);
    }
}
