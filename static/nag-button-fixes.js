// Nag Button Fix - Minimal Version
(function() {
    console.log("Nag Button Fix (Minimal Version) loading...");
    
    // Only target these specific problematic attributes
    const PROBLEMATIC_ATTRS = ['iconName', 'layoutTraits', 'data-icon', 'data-src', 'data-layout'];
    
    // Simple function to remove problematic attributes only
    function cleanButtonAttributes(element) {
        if (!element || element.nodeType !== 1) return;
        
        // Remove only the specific problematic attributes
        PROBLEMATIC_ATTRS.forEach(attr => {
            if (element.hasAttribute(attr)) {
                element.removeAttribute(attr);
            }
        });
        
        // Also remove any children that might have problematic attributes
        Array.from(element.children).forEach(child => {
            if (PROBLEMATIC_ATTRS.some(attr => child.hasAttribute(attr))) {
                try {
                    element.removeChild(child);
                } catch (e) { /* Ignore errors here */ }
            }
        });
    }
    
    // Process all current buttons/spans in the document
    function processExistingButtons() {
        const elements = document.querySelectorAll('button, .control-span, [role="button"], .orb');
        console.log(`Found ${elements.length} button elements to fix`);
        
        elements.forEach(element => {
            cleanButtonAttributes(element);
        });
    }
    
    // Set up a mutation observer to catch new elements
    function observeButtonChanges() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.tagName === 'BUTTON' || 
                                (node.classList && node.classList.contains('control-span')) ||
                                node.getAttribute('role') === 'button' ||
                                (node.classList && node.classList.contains('orb'))) {
                                cleanButtonAttributes(node);
                            }
                        }
                    });
                }
                
                if (mutation.type === 'attributes' && 
                    PROBLEMATIC_ATTRS.includes(mutation.attributeName)) {
                    cleanButtonAttributes(mutation.target);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: PROBLEMATIC_ATTRS
        });
        
        console.log("Button observer started");
    }
    
    // Make sure buttons are actually clickable
    function ensureButtonsAreClickable() {
        const controls = document.querySelectorAll('.control-span');
        controls.forEach(control => {
            if (!control.classList.contains('disabled')) {
                control.style.display = 'inline-block';
                control.style.visibility = 'visible';
                control.style.opacity = '1';
                control.style.pointerEvents = 'auto';
                control.style.cursor = 'pointer';
            }
        });
    }
    
    // Main initialization function
    function initButtonFix() {
        console.log("Initializing button fix...");
        processExistingButtons();
        observeButtonChanges();
        ensureButtonsAreClickable();
        
        // Make functions available globally for debugging
        window.cleanButtonAttributes = cleanButtonAttributes;
        window.processExistingButtons = processExistingButtons;
        window.ensureButtonsAreClickable = ensureButtonsAreClickable;
        
        console.log("Button fix initialized");
    }
    
    // Run when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButtonFix);
    } else {
        initButtonFix();
    }
    
    // Also run on window load
    window.addEventListener('load', function() {
        setTimeout(function() {
            processExistingButtons();
            ensureButtonsAreClickable();
        }, 500);
    });
    
    console.log("Nag Button Fix (Minimal Version) loaded");
})(); 