/**
 * 标准配件目录 API。
 */
export async function fetchAccessoryCatalog({includeDisabled = false} = {}) {
  const response = await fetch(`/api/accessories?includeDisabled=${includeDisabled ? 'true' : 'false'}`);
  if (!response.ok) throw new Error(`配件目录读取失败：HTTP ${response.status}`);
  return await response.json();
}

export async function saveAccessoryCatalog(item) {
  const hasId = Number(item?.id) > 0;
  const response = await fetch(hasId ? `/api/accessories/${item.id}` : '/api/accessories', {
    method:hasId ? 'PUT' : 'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(item)
  });
  if (!response.ok) throw new Error(await readError(response,'配件保存失败'));
  return await response.json();
}

export async function deleteAccessoryCatalog(id) {
  const response = await fetch(`/api/accessories/${id}`,{method:'DELETE'});
  if (!response.ok) throw new Error(await readError(response,'配件删除失败'));
}

async function readError(response,fallback) {
  try {
    const payload=await response.json();
    return payload?.message || payload?.detail || fallback;
  } catch {
    return fallback;
  }
}
