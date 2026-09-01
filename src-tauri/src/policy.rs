//! Undocumented Windows COM interfaces for Audio routing:
//! 1. `IPolicyConfig`: Set system default render endpoint.
//! 2. `IAudioPolicyConfigFactory`: Native per-app audio routing (SetPersistedDefaultAudioEndpoint)
//!    using Windows 10/11 WinRT `Windows.Media.Internal.AudioPolicyConfig`.

use std::ffi::c_void;
use windows::{
    core::{imp::CanInto, HSTRING, Interface, Param, PCWSTR, GUID, HRESULT},
    Win32::Media::Audio::{EDataFlow, ERole, eRender},
    Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED},
    Win32::System::WinRT::RoGetActivationFactory,
};

pub const CLSID_POLICY_CONFIG_CLIENT: GUID =
    GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

// ---------------------------------------------------------------------------
// 1. IPolicyConfig (System Default Device)
// ---------------------------------------------------------------------------

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

pub fn set_default_endpoint(device_id: &str) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let policy_config: IPolicyConfig = match CoCreateInstance(&CLSID_POLICY_CONFIG_CLIENT, None, CLSCTX_ALL) {
            Ok(pc) => pc,
            Err(e) => return Err(format!("CoCreateInstance(PolicyConfigClient) failed: {e}")),
        };

        let wide: Vec<u16> = device_id.encode_utf16().chain(std::iter::once(0)).collect();
        let pcw = PCWSTR(wide.as_ptr());

        let roles = [
            windows::Win32::Media::Audio::eConsole,
            windows::Win32::Media::Audio::eMultimedia,
            windows::Win32::Media::Audio::eCommunications,
        ];
        for &role in &roles {
            if let Err(e) = policy_config.set_default_endpoint(pcw, role) {
                return Err(format!("SetDefaultEndpoint({device_id}, {role:?}) failed: {e}"));
            }
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// 2. IAudioPolicyConfigFactory (Per-Application Native Audio Routing)
// ---------------------------------------------------------------------------

// Windows 11 / Windows 10 21H2+ IID
pub const IID_AUDIO_POLICY_CONFIG_21H2: GUID =
    GUID::from_u128(0xab3d4648_e242_459f_b02f_541c70306324);
// Windows 10 RS4 - 21H1 IID
pub const IID_AUDIO_POLICY_CONFIG_DOWNLEVEL: GUID =
    GUID::from_u128(0x2a59116d_6c4f_45e0_a74f_707e3fef9258);

#[repr(transparent)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IAudioPolicyConfigFactory(windows::core::IUnknown);

impl CanInto<windows::core::IUnknown> for IAudioPolicyConfigFactory {}

unsafe impl Interface for IAudioPolicyConfigFactory {
    type Vtable = IAudioPolicyConfigFactory_Vtbl;
    const IID: GUID = IID_AUDIO_POLICY_CONFIG_21H2;
}

#[repr(transparent)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IAudioPolicyConfigFactoryDownlevel(windows::core::IUnknown);

impl CanInto<windows::core::IUnknown> for IAudioPolicyConfigFactoryDownlevel {}

unsafe impl Interface for IAudioPolicyConfigFactoryDownlevel {
    type Vtable = IAudioPolicyConfigFactory_Vtbl;
    const IID: GUID = IID_AUDIO_POLICY_CONFIG_DOWNLEVEL;
}

#[repr(C)]
#[doc(hidden)]
#[allow(non_snake_case)]
pub struct IAudioPolicyConfigFactory_Vtbl {
    pub base__: ::windows::core::IUnknown_Vtbl,
    // WinRT methods on IInspectable when treated as IUnknown:
    pub get_iids: usize,
    pub get_runtime_class_name: usize,
    pub get_trust_level: usize,
    // 19 incomplete stubs
    pub slot1: usize,
    pub slot2: usize,
    pub slot3: usize,
    pub slot4: usize,
    pub slot5: usize,
    pub slot6: usize,
    pub slot7: usize,
    pub slot8: usize,
    pub slot9: usize,
    pub slot10: usize,
    pub slot11: usize,
    pub slot12: usize,
    pub slot13: usize,
    pub slot14: usize,
    pub slot15: usize,
    pub slot16: usize,
    pub slot17: usize,
    pub slot18: usize,
    pub slot19: usize,
    pub set_persisted_default_audio_endpoint: unsafe extern "system" fn(
        this: *mut c_void,
        process_id: u32,
        flow: EDataFlow,
        role: ERole,
        device_id: windows::core::HSTRING,
    ) -> HRESULT,
    pub get_persisted_default_audio_endpoint: usize,
    pub clear_all_persisted_application_default_endpoints: usize,
}

impl IAudioPolicyConfigFactory {
    pub unsafe fn set_persisted_default_audio_endpoint(
        &self,
        process_id: u32,
        flow: EDataFlow,
        role: ERole,
        device_id: windows::core::HSTRING,
    ) -> windows::core::Result<()> {
        let vt = Interface::vtable(self);
        (vt.set_persisted_default_audio_endpoint)(
            Interface::as_raw(self),
            process_id,
            flow,
            role,
            device_id,
        )
        .ok()
    }
}

/// Routes a specific process ID to an audio endpoint natively using Windows AudioPolicyConfig.
pub fn set_process_audio_endpoint(pid: u32, device_id: Option<&str>) -> Result<(), String> {
    if pid == 0 {
        return Ok(());
    }
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let class_name = HSTRING::from("Windows.Media.Internal.AudioPolicyConfig");

        // Format device endpoint for MMDEVAPI: \\?\SWD#MMDEVAPI#{device_id}#{e6327cad-dcec-4949-ae8a-991e976a79d2}
        let full_dev_str = device_id.map(|d| {
            format!(r"\\?\SWD#MMDEVAPI#{}#{{e6327cad-dcec-4949-ae8a-991e976a79d2}}", d)
        });

        let hstr = full_dev_str.map(HSTRING::from).unwrap_or_default();

        let roles = [
            windows::Win32::Media::Audio::eMultimedia,
            windows::Win32::Media::Audio::eConsole,
        ];

        // Try Windows 11 / 21H2+ IID
        if let Ok(factory) = RoGetActivationFactory::<IAudioPolicyConfigFactory>(&class_name) {
            let mut last_res = Ok(());
            for &role in &roles {
                if let Err(e) = factory.set_persisted_default_audio_endpoint(pid, eRender, role, hstr.clone()) {
                    last_res = Err(format!("set_persisted_default_audio_endpoint failed: {e}"));
                }
            }
            return last_res;
        }

        // Try Downlevel IID
        if let Ok(factory_downlevel) = RoGetActivationFactory::<IAudioPolicyConfigFactoryDownlevel>(&class_name) {
            let raw: IAudioPolicyConfigFactory = std::mem::transmute(factory_downlevel);
            let mut last_res = Ok(());
            for &role in &roles {
                if let Err(e) = raw.set_persisted_default_audio_endpoint(pid, eRender, role, hstr.clone()) {
                    last_res = Err(format!("set_persisted_default_audio_endpoint downlevel failed: {e}"));
                }
            }
            return last_res;
        }

        Err("Failed to activate AudioPolicyConfig COM factory".into())
    }
}
