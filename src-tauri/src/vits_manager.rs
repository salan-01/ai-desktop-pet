use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct VitsManager {
    child: Mutex<Option<Child>>,
    vits_path: Mutex<PathBuf>,
}

impl VitsManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            vits_path: Mutex::new(PathBuf::new()),
        }
    }

    pub fn set_path(&self, path: PathBuf) {
        if let Ok(mut p) = self.vits_path.lock() {
            *p = path;
        }
    }

    pub fn get_path(&self) -> PathBuf {
        self.vits_path.lock().map(|p| p.clone()).unwrap_or_default()
    }

    fn python_exe(&self) -> Result<PathBuf, String> {
        let base = self.get_path();
        if base.as_os_str().is_empty() {
            return Err("VITS 路径未配置".into());
        }
        #[cfg(windows)]
        let py = base.join("py310").join("python.exe");
        #[cfg(not(windows))]
        let py = base.join("py310").join("bin").join("python");
        if !py.exists() {
            return Err(format!("找不到 Python: {}", py.display()));
        }
        Ok(py)
    }

    fn app_py(&self) -> Result<PathBuf, String> {
        let base = self.get_path();
        let app = base.join("app.py");
        if !app.exists() {
            return Err(format!("找不到 app.py: {}", app.display()));
        }
        Ok(app)
    }

    /// Validate that the VITS folder contains required files.
    pub fn validate(&self) -> Result<(), String> {
        self.python_exe()?;
        self.app_py()?;
        Ok(())
    }

    /// Start the VITS server as a background process (no console window).
    pub fn start(&self) -> Result<String, String> {
        // If already running, check whether it's alive
        {
            let mut guard = self.child.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut child) = *guard {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        // Process exited previously, clear old handle
                        *guard = None;
                    }
                    Ok(None) => {
                        // Still running
                        if self.is_server_responding() {
                            return Ok("already_running".into());
                        }
                        return Ok("starting".into());
                    }
                    Err(_) => {
                        *guard = None;
                    }
                }
            }
        }

        let python = self.python_exe()?;
        let _app = self.app_py()?;
        let base = self.get_path();

        let mut cmd = Command::new(&python);
        cmd.arg("app.py")
            .current_dir(&base)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null());

        #[cfg(windows)]
        {
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let child = cmd.spawn().map_err(|e| format!("无法启动 VITS: {}", e))?;

        // Store child handle
        if let Ok(mut guard) = self.child.lock() {
            *guard = Some(child);
        }

        // Wait briefly then check if it's responding
        std::thread::sleep(Duration::from_millis(500));
        if self.is_server_responding() {
            Ok("running".into())
        } else if self.is_process_alive() {
            Ok("starting".into())
        } else {
            Ok("error".into())
        }
    }

    /// Kill the VITS server process tree.
    pub fn stop(&self) {
        let pid = {
            let mut guard = match self.child.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            if let Some(ref mut child) = *guard {
                let pid = child.id();
                // Try graceful kill first
                let _ = child.kill();
                *guard = None;
                pid
            } else {
                return;
            }
        };

        // Force kill process tree on Windows (Python+PyTorch spawns workers)
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(&["/F", "/T", "/PID", &pid.to_string()])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }

    pub fn status(&self) -> String {
        if self.is_server_responding() {
            return "running".into();
        }
        if self.is_process_alive() {
            return "starting".into();
        }
        let guard = match self.child.lock() {
            Ok(g) => g,
            Err(_) => return "error".into(),
        };
        if guard.is_some() {
            // Process was started but died
            "error".into()
        } else {
            "stopped".into()
        }
    }

    fn is_process_alive(&self) -> bool {
        let mut guard = match self.child.lock() {
            Ok(g) => g,
            Err(_) => return false,
        };
        if let Some(ref mut child) = *guard {
            match child.try_wait() {
                Ok(None) => return true, // still running
                Ok(Some(_)) => {
                    *guard = None; // exited, clear handle
                    return false;
                }
                Err(_) => {
                    *guard = None;
                    return false;
                }
            }
        }
        false
    }

    fn is_server_responding(&self) -> bool {
        TcpStream::connect_timeout(&"127.0.0.1:23456".parse().unwrap(), Duration::from_secs(2))
            .is_ok()
    }
}
