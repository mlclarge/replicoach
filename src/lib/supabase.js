import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// =====================================================
// AUTHENTIFICATION
// =====================================================

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// =====================================================
// UPLOAD DE FICHIERS (Scripts PDF)
// =====================================================

export const uploadPDF = async (file, userId) => {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const fileName = `${userId}/${timestamp}_${safeName}`
  
  const { data, error } = await supabase.storage
    .from('scripts-pdfs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })
    
  if (error) throw error
  
  return data.path
}

// Alias pour compatibilité avec Upload.jsx
export const uploadFile = uploadPDF

export const getFileUrl = (path) => {
  if (!path) return null
  const { data } = supabase.storage
    .from('scripts-pdfs')
    .getPublicUrl(path)
  
  return data.publicUrl
}

export const deleteFile = async (path) => {
  const { error } = await supabase.storage
    .from('scripts-pdfs')
    .remove([path])
  
  if (error) throw error
}

// =====================================================
// DIRECTOR NOTES (Consignes du metteur en scène)
// =====================================================

export const uploadDirectorNote = async (file, userId) => {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const fileName = `${userId}/${timestamp}_${safeName}`
  
  // Upload du fichier
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('director-notes')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })
    
  if (uploadError) throw uploadError
  
  // Enregistrer les métadonnées
  const { data, error } = await supabase
    .from('director_notes')
    .insert([{
      user_id: userId,
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      file_type: file.type
    }])
    .select()
    .single()
  
  if (error) throw error
  
  return data
}

export const fetchDirectorNotes = async (userId) => {
  const { data, error } = await supabase
    .from('director_notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const deleteDirectorNote = async (noteId, filePath) => {
  // Supprimer le fichier du storage
  if (filePath) {
    await supabase.storage
      .from('director-notes')
      .remove([filePath])
  }
  
  // Supprimer l'entrée de la base
  const { error } = await supabase
    .from('director_notes')
    .delete()
    .eq('id', noteId)
  
  if (error) throw error
}

export const getDirectorNoteUrl = (path) => {
  if (!path) return null
  const { data } = supabase.storage
    .from('director-notes')
    .getPublicUrl(path)
  
  return data.publicUrl
}

// =====================================================
// TROUPES
// =====================================================

// Créer une troupe
export const createTroupe = async (name, ownerId) => {
  const { data, error } = await supabase
    .from('troupes')
    .insert([{ name, owner_id: ownerId }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Récupérer les troupes de l'utilisateur
export const fetchUserTroupes = async (userId) => {
  const { data, error } = await supabase
    .from('troupe_members')
    .select(`
      role,
      joined_at,
      troupes (
        id,
        name,
        code,
        owner_id,
        created_at
      )
    `)
    .eq('user_id', userId)
  
  if (error) throw error
  return data?.map(item => ({ ...item.troupes, role: item.role })) || []
}

// Rejoindre une troupe par code
export const joinTroupe = async (code, userId) => {
  // Trouver la troupe par code
  const { data: troupe, error: findError } = await supabase
    .from('troupes')
    .select('id')
    .eq('code', code.toUpperCase())
    .single()
  
  if (findError) {
    if (findError.code === 'PGRST116') {
      throw new Error('Code de troupe invalide')
    }
    throw findError
  }
  
  // Vérifier si déjà membre
  const { data: existing } = await supabase
    .from('troupe_members')
    .select('id')
    .eq('troupe_id', troupe.id)
    .eq('user_id', userId)
    .single()
  
  if (existing) {
    throw new Error('Vous êtes déjà membre de cette troupe')
  }
  
  // Rejoindre
  const { data, error } = await supabase
    .from('troupe_members')
    .insert([{ troupe_id: troupe.id, user_id: userId, role: 'member' }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Quitter une troupe
export const leaveTroupe = async (troupeId, userId) => {
  const { error } = await supabase
    .from('troupe_members')
    .delete()
    .eq('troupe_id', troupeId)
    .eq('user_id', userId)
  
  if (error) throw error
}

// Supprimer une troupe (owner uniquement)
export const deleteTroupe = async (troupeId) => {
  // La suppression cascade supprimera aussi les membres (ON DELETE CASCADE)
  const { error } = await supabase
    .from('troupes')
    .delete()
    .eq('id', troupeId)
  
  if (error) throw error
}

// Récupérer les membres d'une troupe
export const fetchTroupeMembers = async (troupeId) => {
  const { data, error } = await supabase
    .from('troupe_members')
    .select(`
      user_id,
      role,
      joined_at
    `)
    .eq('troupe_id', troupeId)
  
  if (error) throw error
  return data
}

// =====================================================
// PARTAGE DE SCRIPTS
// =====================================================

// Partager un script avec une troupe
export const shareScript = async (scriptId, troupeId, userId) => {
  const { data, error } = await supabase
    .from('shared_scripts')
    .insert([{
      script_id: scriptId,
      troupe_id: troupeId,
      shared_by: userId
    }])
    .select()
    .single()
  
  if (error) {
    if (error.code === '23505') {
      throw new Error('Ce texte est déjà partagé avec cette troupe')
    }
    throw error
  }
  return data
}

// Retirer le partage d'un script
export const unshareScript = async (scriptId, troupeId) => {
  const { error } = await supabase
    .from('shared_scripts')
    .delete()
    .eq('script_id', scriptId)
    .eq('troupe_id', troupeId)
  
  if (error) throw error
}

// Récupérer les scripts partagés avec l'utilisateur
export const fetchSharedScripts = async (userId) => {
  // D'abord, récupérer les troupes de l'utilisateur
  const { data: memberships, error: memberError } = await supabase
    .from('troupe_members')
    .select('troupe_id')
    .eq('user_id', userId)
  
  if (memberError) throw memberError
  
  if (!memberships || memberships.length === 0) {
    return []
  }
  
  const troupeIds = memberships.map(m => m.troupe_id)
  
  // Récupérer les scripts partagés avec ces troupes
  const { data, error } = await supabase
    .from('shared_scripts')
    .select(`
      id,
      shared_at,
      shared_by,
      troupe_id,
      scripts (
        id,
        title,
        user_id,
        characters (*),
        replicas (*)
      ),
      troupes (
        name
      )
    `)
    .in('troupe_id', troupeIds)
  
  if (error) throw error
  
  // Filtrer les scripts qui ne sont pas de l'utilisateur (pas ses propres scripts partagés)
  return data?.filter(item => item.scripts?.user_id !== userId) || []
}

// =====================================================
// DOCUMENTS PUBLICS
// =====================================================

// Uploader un document public
export const uploadPublicDocument = async (file, metadata, userId) => {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const fileName = `${timestamp}_${safeName}`
  
  // Upload du fichier
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('public-documents')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })
    
  if (uploadError) throw uploadError
  
  // Déterminer le type de fichier
  let fileType = 'other'
  if (file.type === 'application/pdf') fileType = 'pdf'
  else if (file.type.startsWith('image/')) fileType = 'image'
  else if (file.type === 'text/plain') fileType = 'txt'
  
  // Enregistrer les métadonnées
  const { data, error } = await supabase
    .from('public_documents')
    .insert([{
      title: metadata.title || file.name,
      description: metadata.description || '',
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      file_type: fileType,
      category: metadata.category || 'script',
      uploaded_by: userId,
      is_approved: false // En attente de modération
    }])
    .select()
    .single()
  
  if (error) throw error
  
  return data
}

// Récupérer les documents publics approuvés
export const fetchPublicDocuments = async (category = null) => {
  let query = supabase
    .from('public_documents')
    .select('*')
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
  
  if (category) {
    query = query.eq('category', category)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  return data
}

// Récupérer l'URL d'un document public
export const getPublicDocumentUrl = (path) => {
  if (!path) return null
  const { data } = supabase.storage
    .from('public-documents')
    .getPublicUrl(path)
  
  return data.publicUrl
}

// Supprimer un document public (seulement par son propriétaire)
export const deletePublicDocument = async (documentId, filePath) => {
  // Supprimer le fichier du storage
  if (filePath) {
    const { error: storageError } = await supabase.storage
      .from('public-documents')
      .remove([filePath])
    
    if (storageError) {
      console.error('Erreur suppression storage:', storageError)
    }
  }
  
  // Supprimer l'entrée dans la table
  const { error } = await supabase
    .from('public_documents')
    .delete()
    .eq('id', documentId)
  
  if (error) throw error
}

// Incrémenter le compteur de téléchargement
export const incrementDownloadCount = async (documentId) => {
  const { error } = await supabase.rpc('increment_download_count', {
    doc_id: documentId
  })
  
  // Ignorer l'erreur si la fonction RPC n'existe pas
  if (error && !error.message.includes('function')) {
    throw error
  }
}

// =====================================================
// SYSTÈME DE TAGS
// =====================================================

// Récupérer tous les tags de l'utilisateur
export const fetchUserTags = async (userId) => {
  const { data, error } = await supabase
    .from('user_tags')
    .select('*')
    .eq('user_id', userId)
    .order('name')
  
  if (error) {
    console.error('Error fetching tags:', error)
    return []
  }
  return data || []
}

// Créer un nouveau tag
export const createTag = async (userId, name, color = '#6B7280') => {
  const { data, error } = await supabase
    .from('user_tags')
    .insert([{ user_id: userId, name, color }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Supprimer un tag
export const deleteTag = async (tagId) => {
  const { error } = await supabase
    .from('user_tags')
    .delete()
    .eq('id', tagId)
  
  if (error) throw error
}

// Modifier un tag
export const updateTag = async (tagId, updates) => {
  const { data, error } = await supabase
    .from('user_tags')
    .update(updates)
    .eq('id', tagId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Récupérer les tags d'un script
export const fetchScriptTags = async (scriptId) => {
  const { data, error } = await supabase
    .from('script_tags')
    .select(`
      id,
      tag_id,
      user_tags (
        id,
        name,
        color
      )
    `)
    .eq('script_id', scriptId)
  
  if (error) {
    console.error('Error fetching script tags:', error)
    return []
  }
  return data?.map(st => st.user_tags) || []
}

// Ajouter un tag à un script
export const addTagToScript = async (scriptId, tagId) => {
  const { data, error } = await supabase
    .from('script_tags')
    .insert([{ script_id: scriptId, tag_id: tagId }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Retirer un tag d'un script
export const removeTagFromScript = async (scriptId, tagId) => {
  const { error } = await supabase
    .from('script_tags')
    .delete()
    .eq('script_id', scriptId)
    .eq('tag_id', tagId)
  
  if (error) throw error
}

// Récupérer tous les scripts avec leurs tags
export const fetchScriptsWithTags = async (userId) => {
  const { data: scripts, error: scriptsError } = await supabase
    .from('scripts')
    .select(`
      *,
      characters (*),
      script_tags (
        user_tags (
          id,
          name,
          color
        )
      )
    `)
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
  
  if (scriptsError) {
    console.error('Error fetching scripts with tags:', scriptsError)
    return []
  }
  
  // Transformer les données pour avoir les tags directement
  return scripts?.map(script => ({
    ...script,
    tags: script.script_tags?.map(st => st.user_tags).filter(Boolean) || []
  })) || []
}
