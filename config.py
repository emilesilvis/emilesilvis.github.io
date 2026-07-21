SITE_NAME = "Emile Silvis"

# Site configuration
HOSTNAME = "https://emilesilvis.com"  # Base URL for absolute meta image tags

# Analytics configuration
UMAMI = {
    "website_id": "4749f200-c2a0-41ec-aebb-082df6d0e2f6"
}

# Bio configuration
BIO = {
    "name": "Emile Silvis",
    "bio": "Welcome to my corner of the web.",
    "image": "/static/images/profile.png",
    "social": {
        "x": {
            "url": "https://x.com/emilesilvis",
            "icon": "/static/icons/x.svg"
        },
        "linkedin": {
            "url": "https://linkedin.com/in/emilesilvis",
            "icon": "/static/icons/linkedin.svg"
        },
        "github": {
            "url": "https://github.com/emilesilvis",
            "icon": "/static/icons/github.svg"
        },
        "rss": {
            "url": "/feed.xml",
            "icon": "/static/icons/rss.svg"
        }
    }
}

# Navigation configuration
NAVIGATION = [
    {
        "title": "Posts",
        "path": "/"
    },
    {
        "title": "Projects",
        "path": "/projects"
    },
    {
        "title": "Books read",
        "path": "/books-read"
    },
    {
        "title": "Maths stuff",
        "path": "/maths"
    }
]