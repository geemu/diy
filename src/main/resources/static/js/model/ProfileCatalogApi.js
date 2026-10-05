const API='/api/profile-catalog';

/**
 * 读取数据库型材目录。
 *
 * Profile Catalog 2.0 的管理器需要看到已停用型号，所以默认包含 disabled；左侧实际可用型材列表由
 * app.js 再按 enabled 过滤，避免“管理数据”和“可绘制数据”混成一层。
 */
export async function fetchDatabaseProfiles({includeDisabled=true}={}){
  const response=await fetch(`${API}?includeDisabled=${includeDisabled?'true':'false'}`,{headers:{Accept:'application/json'}});
  if(!response.ok) throw new Error(`型材数据库读取失败：HTTP ${response.status}`);
  return await response.json();
}

export async function saveDatabaseProfile(profile){
  const id=String(profile?.id||'').trim();
  if(!id)throw new Error('自定义型材 ID 不能为空');
  const response=await fetch(`${API}/${encodeURIComponent(id)}`,{
    method:'PUT',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(profile)
  });
  if(!response.ok)throw new Error(await readError(response));
  return await response.json();
}

export async function deleteDatabaseProfile(id){
  const response=await fetch(`${API}/${encodeURIComponent(id)}`,{method:'DELETE'});
  if(!response.ok)throw new Error(await readError(response));
}

async function readError(response){
  try{
    const body=await response.json();
    return body?.message||body?.detail||`HTTP ${response.status}`;
  }catch{return `HTTP ${response.status}`;}
}
