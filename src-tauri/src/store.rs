//! Persistent configuration (JSON) for Mixero.

use crate::types::Config;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

pub struct Store {
    path: PathBuf,
    config: RwLock<Config>,
}

impl Store {
    pub fn load(dir: &PathBuf) -> Self {
        let _ = fs::create_dir_all(dir);
        let path = dir.join("config.json");
        let config = fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<Config>(&s).ok())
            .unwrap_or_default();
        Self {
            path,
            config: RwLock::new(config),
        }
    }

    pub fn get(&self) -> Config {
        self.config.read().unwrap().clone()
    }

    pub fn update<T>(&self, f: impl FnOnce(&mut Config) -> T) -> T {
        let mut guard = self.config.write().unwrap();
        let out = f(&mut guard);
        self.persist(&guard);
        out
    }

    pub fn replace(&self, config: Config) {
        let mut guard = self.config.write().unwrap();
        *guard = config;
        self.persist(&guard);
    }

    fn persist(&self, config: &Config) {
        if let Ok(json) = serde_json::to_string_pretty(config) {
            let tmp = self.path.with_extension("json.tmp");
            if fs::write(&tmp, json).is_ok() {
                let _ = fs::rename(&tmp, &self.path);
            }
        }
    }
}
