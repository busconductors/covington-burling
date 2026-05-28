/**
 * Covington & Burling LLP — PDF Generation
 * Handles PDF download buttons on waiver-nda.html
 */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.btn--download').forEach(button => {
    button.addEventListener('click', async () => {
      const type = button.getAttribute('data-pdf');
      if (!type) return;

      const originalText = button.textContent;
      button.textContent = 'Generating PDF...';
      button.disabled = true;

      try {
        const endpoint = type === 'waiver' ? '/api/generate-waiver' : '/api/generate-nda';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        if (!response.ok) throw new Error('Server returned ' + response.status);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = type === 'waiver' ? 'waiver-release-of-liability.pdf' : 'mutual-nda.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('PDF server unavailable, redirecting to LaTeX source:', err.message);
        const fallback = type === 'waiver' ? '/latex/waiver.tex' : '/latex/nda.tex';
        window.location.href = fallback;
      } finally {
        button.textContent = originalText;
        button.disabled = false;
      }
    });
  });
});