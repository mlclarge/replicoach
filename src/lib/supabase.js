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
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'replicoach-auth',
  }
})

// ============================================
// AUTHENTIFICATION
// ============================================

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ============================================
// SCRIPTS - PDFs et TXT des saynètes
// ============================================

/**
 * Upload un fichier (PDF ou TXT) pour un script
 * @param {File} file - Le fichier à uploader
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string>} - Le chemin du fichier
 */
export const uploadFile = async (file, userId) => {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const fileName = `${userId}/${timestamp}_${safeName}`
  
  const { data, error } = await supabase.storage
    .from('scripts-pdfs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream'
    })
    
  if (error) throw error
  
  return data.path
}

// Alias pour compatibilité
export const uploadPDF = uploadFile

/**
 * Récupère l'URL publique d'un fichier
 */
export const getFileUrl = (path, bucket = 'scripts-pdfs') => {
  if (!path) return null
  
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)
  
  return data.publicUrl
}

/**
 * Télécharge le contenu d'un fichier
 */
export const downloadFile = async (path, bucket = 'scripts-pdfs') => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path)
    
  if (error) throw error
  
  return data
}

/**
 * Supprime un fichier
 */
export const deleteFile = async (path, bucket = 'scripts-pdfs') => {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])
  
  if (error) throw error
}

// ============================================
// CONSIGNES METTEUR EN SCÈNE
// ============================================

/**
 * Upload une consigne PDF/TXT du metteur en scène
 */
export const uploadDirectorNote = async (file, userId) => {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${userId}/${timestamp}_${safeName}`
  
  // 1. Upload du fichier dans le bucket
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('director-notes')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream'
    })
    
  if (uploadError) throw uploadError
  
  // 2. Récupérer l'URL publique
  const { data: urlData } = supabase.storage
    .from('director-notes')
    .getPublicUrl(filePath)
  
  // 3. Sauvegarder les métadonnées en base
  const { data: noteData, error: noteError } = await supabase
    .from('director_notes')
    .insert({
      user_id: userId,
      filename: file.name,
      file_path: filePath,
      file_url: urlData.publicUrl,
      file_size: file.size
    })
    .select()
    .single()
    
  if (noteError) throw noteError
  
  return noteData
}

/**
 * Récupérer toutes les consignes du metteur en scène pour un utilisateur
 */
export const fetchDirectorNotes = async (userId) => {
  const { data, error } = await supabase
    .from('director_notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    
  if (error) throw error
  
  return data || []
}

/**
 * Supprimer une consigne
 */
export const deleteDirectorNote = async (noteId, filePath) => {
  // 1. Supprimer le fichier du storage
  const { error: storageError } = await supabase.storage
    .from('director-notes')
    .remove([filePath])
    
  if (storageError) {
    console.warn('Erreur suppression fichier:', storageError)
  }
  
  // 2. Supprimer l'entrée en base
  const { error: dbError } = await supabase
    .from('director_notes')
    .delete()
    .eq('id', noteId)
    
  if (dbError) throw dbError
}

// ============================================
// NUMÉROTATION DES SCRIPTS
// ============================================

/**
 * Obtenir le prochain numéro d'ordre disponible
 */
export const getNextDisplayOrder = async (userId) => {
  const { data, error } = await supabase
    .from('scripts')
    .select('display_order')
    .eq('user_id', userId)
    .order('display_order', { ascending: false })
    .limit(1)
    
  if (error) throw error
  
  if (data && data.length > 0) {
    return (data[0].display_order || 0) + 1
  }
  
  return 1
}

/**
 * Renuméroter tous les scripts à partir de 1
 */
export const renumberAllScripts = async (userId) => {
  // 1. Récupérer tous les scripts triés par ordre actuel
  const { data: scripts, error: fetchError } = await supabase
    .from('scripts')
    .select('id, display_order')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    
  if (fetchError) throw fetchError
  
  // 2. Mettre à jour chaque script avec le nouvel ordre
  const updates = scripts.map((script, index) => ({
    id: script.id,
    display_order: index + 1
  }))
  
  for (const update of updates) {
    const { error } = await supabase
      .from('scripts')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
      
    if (error) throw error
  }
  
  return updates
}

/**
 * Mettre à jour l'ordre de plusieurs scripts
 */
export const updateScriptsOrder = async (updates) => {
  for (const update of updates) {
    const { error } = await supabase
      .from('scripts')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
      
    if (error) throw error
  }
}
