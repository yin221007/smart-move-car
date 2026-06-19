import { useState } from "react";

export function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, password })
    });
    if (response.ok) {
      window.location.href = "/dashboard";
    } else {
      setError("用户名或密码不正确");
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={login}>
        <h1>扫码挪车后台</h1>
        <label>
          用户名
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className="primary-button" type="submit">
          登录
        </button>
        {error ? <p className="result-text">{error}</p> : null}
      </form>
    </main>
  );
}
