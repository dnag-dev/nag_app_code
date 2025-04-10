// Nag Button Fix - Minimal Version
(function() {
    console.log("Nag Button Fix (Minimal Version) loading...");
    
    // Only target these specific problematic attributes
    const PROBLEMATIC_ATTRS = ['iconName', 'layoutTraits', 'data-icon', 'data-src', 'data-layout', 'src'];
    
    // Simple function to remove problematic attributes only
    function cleanButtonAttributes(element) {
        if (!element || element.nodeType !== 1) return;
        
        // Save all event handlers and important attributes
        const handlers = {
            onclick: element.onclick,
            onmousedown: element.onmousedown,
            onmouseup: element.onmouseup,
            ontouchstart: element.ontouchstart,
            ontouchend: element.ontouchend
        };
        
        const attributes = {
            id: element.id,
            className: element.className,
            role: element.getAttribute('role'),
            tabindex: element.getAttribute('tabindex'),
            'aria-label': element.getAttribute('aria-label')
        };
        
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
        
        // Restore event handlers and attributes
        Object.entries(handlers).forEach(([event, handler]) => {
            if (handler) element[event] = handler;
        });
        
        Object.entries(attributes).forEach(([attr, value]) => {
            if (value) element.setAttribute(attr, value);
        });
        
        // Ensure element is visible and clickable
        element.style.display = 'inline-block';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
        element.style.cursor = 'pointer';
        
        // Remove any styles that might block interaction
        element.style.webkitAppearance = 'none';
        element.style.appearance = 'none';
        element.style.webkitTapHighlightColor = 'transparent';
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
    
    // Main initialization function
    function initButtonFix() {
        console.log("Initializing button fix...");
        processExistingButtons();
        observeButtonChanges();
        
        // Make functions available globally for debugging
        window.cleanButtonAttributes = cleanButtonAttributes;
        window.processExistingButtons = processExistingButtons;
        
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
        }, 500);
    });
    
    console.log("Nag Button Fix (Minimal Version) loaded");
})(); 