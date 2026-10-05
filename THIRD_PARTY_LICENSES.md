# Third-party software

- Vue.js — MIT License
- Three.js — MIT License
- JSZip — MIT License
- SQLite JDBC (Xerial) — Apache License 2.0

## Runtime delivery

Vue and JSZip are checked into `src/main/resources/static/vendor`.

Three.js r155 is resolved during Maven resource generation from the Maven artifact `org.webjars.npm:three:0.155.0`, then the required browser files are copied into:

```text
target/classes/static/vendor/three/
```

The Spring Boot application serves those files as ordinary local static resources. No runtime CDN and no custom WebJar HTTP mapping are used.
